param(
    [int]$Port = 8765
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$DataDir = Join-Path $Root 'data'
$MediaDir = Join-Path $Root 'media'
$StateFile = Join-Path $DataDir 'state.json'
$DefaultStateFile = Join-Path $DataDir 'default_state.json'
$LibraryConfigFile = Join-Path $DataDir 'library_config.json'
$CustomSpellLibraryFile = Join-Path $DataDir 'custom_spells.json'
$Utf8 = New-Object System.Text.UTF8Encoding($false)
# PowerShell server is intentionally dependency-free, but it handles one socket at a time.
# Keep media range responses small so a large MP4 cannot monopolize the server and
# starve /api/state, the DM preview, or the tabletop output.
$MediaStreamChunkBytes = 2MB

New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
New-Item -ItemType Directory -Force -Path $MediaDir | Out-Null

$LibraryDefs = [ordered]@{
    'maps' = [pscustomobject]@{ Label = 'Maps'; Folder = 'maps'; Kinds = @('image','video') }
    'scene-art' = [pscustomobject]@{ Label = 'Scene Art'; Folder = 'scene-art'; Kinds = @('image','video') }
    'music' = [pscustomobject]@{ Label = 'Music'; Folder = 'music'; Kinds = @('audio') }
    'ambience' = [pscustomobject]@{ Label = 'Ambience'; Folder = 'ambience'; Kinds = @('audio') }
    'sound-effects' = [pscustomobject]@{ Label = 'Sound Effects'; Folder = 'sound-effects'; Kinds = @('audio') }
    'tokens' = [pscustomobject]@{ Label = 'Tokens / Portraits'; Folder = 'tokens'; Kinds = @('image') }
    'handouts' = [pscustomobject]@{ Label = 'Handouts'; Folder = 'handouts'; Kinds = @('image','pdf') }
}
foreach ($def in $LibraryDefs.Values) {
    New-Item -ItemType Directory -Force -Path (Join-Path $MediaDir $def.Folder) | Out-Null
}

[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }

function Get-UnixTime {
    return [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() / 1000.0
}

function Ensure-StateFile {
    if (-not (Test-Path $StateFile)) {
        if (Test-Path $DefaultStateFile) {
            Copy-Item $DefaultStateFile $StateFile -Force
        } else {
            throw 'Default state file is missing.'
        }
    }
}

function Get-State {
    Ensure-StateFile
    return (Get-Content -LiteralPath $StateFile -Raw -Encoding UTF8 | ConvertFrom-Json)
}

function Save-State($State) {
    $now = Get-UnixTime
    if ($State.PSObject.Properties.Name -contains 'updatedAt') {
        $State.updatedAt = $now
    } else {
        $State | Add-Member -NotePropertyName updatedAt -NotePropertyValue $now
    }
    $json = $State | ConvertTo-Json -Depth 50
    $tmp = "$StateFile.tmp"
    [System.IO.File]::WriteAllText($tmp, $json, $Utf8)
    Move-Item -LiteralPath $tmp -Destination $StateFile -Force
}

function Get-ObjectProperty($Object, [string]$Name, $Default = $null) {
    if ($null -ne $Object -and $null -ne $Object.PSObject.Properties[$Name]) { return $Object.$Name }
    return $Default
}

function Get-SpellKey([string]$Value) {
    if ($null -eq $Value) { return '' }
    return (($Value.Replace([char]0x2019, "'").Trim().ToLowerInvariant()) -replace '\s+', ' ')
}

function Get-CustomSpellLibrary {
    if (-not (Test-Path $CustomSpellLibraryFile)) { return @() }
    try {
        $raw = Get-Content -LiteralPath $CustomSpellLibraryFile -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($null -ne $raw.PSObject.Properties['spells']) { return @($raw.spells) }
        return @($raw)
    } catch { return @() }
}

function Save-CustomSpellLibrary($Spells) {
    $payload = [pscustomobject]@{ version = 1; updatedAt = (Get-UnixTime); spells = @($Spells) }
    $json = $payload | ConvertTo-Json -Depth 50
    $tmp = "$CustomSpellLibraryFile.tmp"
    [System.IO.File]::WriteAllText($tmp, $json, $Utf8)
    Move-Item -LiteralPath $tmp -Destination $CustomSpellLibraryFile -Force
}

function Get-SpellClasses($Spell, $Character) {
    $list = New-Object 'System.Collections.Generic.List[string]'
    foreach ($v in @(Get-ObjectProperty $Spell 'classes' @())) {
        $x = [string]$v
        if (-not [string]::IsNullOrWhiteSpace($x) -and -not $list.Contains($x.Trim())) { $list.Add($x.Trim()) }
    }
    $sheet = Get-ObjectProperty $Character 'sheet' $null
    $charClass = if ($null -ne $sheet) { [string](Get-ObjectProperty $sheet 'className' '') } else { '' }
    if (-not [string]::IsNullOrWhiteSpace($charClass) -and -not $list.Contains($charClass.Trim())) { $list.Add($charClass.Trim()) }
    $source = [string](Get-ObjectProperty $Spell 'source' '')
    foreach ($name in @('Artificer','Bard','Cleric','Druid','Paladin','Ranger','Sorcerer','Warlock','Wizard')) {
        if ($source -match ('(?i)\b' + [regex]::Escape($name) + '\b') -and -not $list.Contains($name)) { $list.Add($name) }
    }
    return @($list)
}

function ConvertTo-CustomSpell($Spell, $Character) {
    if ($null -eq $Spell) { return $null }
    $name = [string](Get-ObjectProperty $Spell 'name' '')
    if ([string]::IsNullOrWhiteSpace($name)) { return $null }
    $librarySource = [string](Get-ObjectProperty $Spell 'librarySource' '')
    if ($librarySource.Trim().ToLowerInvariant().StartsWith('srd 5.2.1')) { return $null }
    $level = 0
    [int]::TryParse([string](Get-ObjectProperty $Spell 'level' 0), [ref]$level) | Out-Null
    $level = [Math]::Max(0, [Math]::Min(9, $level))
    $id = [string](Get-ObjectProperty $Spell 'id' '')
    if ([string]::IsNullOrWhiteSpace($librarySource)) {
        $librarySource = if ($id.StartsWith('ddb_spell_')) { 'D&D Beyond Import' } else { 'Custom / Imported' }
    }
    $slug = (Get-SpellKey $name) -replace '[^a-z0-9]+','_'
    $slug = $slug.Trim('_')
    return [pscustomobject]@{
        id = "custom_$slug"; name = $name.Trim(); level = $level
        source = [string](Get-ObjectProperty $Spell 'source' ''); school = [string](Get-ObjectProperty $Spell 'school' '')
        classes = @(Get-SpellClasses $Spell $Character)
        castingTime = [string](Get-ObjectProperty $Spell 'castingTime' (Get-ObjectProperty $Spell 'time' ''))
        range = [string](Get-ObjectProperty $Spell 'range' ''); saveAttack = [string](Get-ObjectProperty $Spell 'saveAttack' (Get-ObjectProperty $Spell 'save' ''))
        components = [string](Get-ObjectProperty $Spell 'components' ''); duration = [string](Get-ObjectProperty $Spell 'duration' '')
        ritual = [bool](Get-ObjectProperty $Spell 'ritual' $false); concentration = [bool](Get-ObjectProperty $Spell 'concentration' $false)
        notes = [string](Get-ObjectProperty $Spell 'notes' ''); description = [string](Get-ObjectProperty $Spell 'description' '')
        librarySource = $librarySource; updatedAt = (Get-UnixTime)
    }
}

function Update-CustomSpellLibraryFromCharacters($Characters) {
    $byKey = [ordered]@{}
    foreach ($existing in @(Get-CustomSpellLibrary)) {
        $key = Get-SpellKey ([string](Get-ObjectProperty $existing 'name' ''))
        if (-not [string]::IsNullOrWhiteSpace($key)) { $byKey[$key] = $existing }
    }
    foreach ($character in @($Characters)) {
        if ($null -eq $character) { continue }
        $sheet = Get-ObjectProperty $character 'sheet' $null
        if ($null -eq $sheet) { continue }
        foreach ($raw in @(Get-ObjectProperty $sheet 'spellbook' @())) {
            $item = ConvertTo-CustomSpell $raw $character
            if ($null -eq $item) { continue }
            $key = Get-SpellKey ([string]$item.name)
            $old = $byKey[$key]
            if ($null -eq $old) { $byKey[$key] = $item; continue }
            foreach ($field in @('name','source','school','castingTime','range','saveAttack','components','duration','notes','description','librarySource')) {
                $value = [string](Get-ObjectProperty $item $field '')
                if (-not [string]::IsNullOrWhiteSpace($value)) { Set-ObjectProperty $old $field $value }
            }
            Set-ObjectProperty $old 'level' $item.level
            if ([bool]$item.ritual) { Set-ObjectProperty $old 'ritual' $true }
            if ([bool]$item.concentration) { Set-ObjectProperty $old 'concentration' $true }
            $classes = New-Object 'System.Collections.Generic.List[string]'
            $allClasses = @((Get-ObjectProperty $old 'classes' @())) + @($item.classes)
            foreach ($v in @($allClasses)) {
                $x=[string]$v; if (-not [string]::IsNullOrWhiteSpace($x) -and -not $classes.Contains($x.Trim())) { $classes.Add($x.Trim()) }
            }
            Set-ObjectProperty $old 'classes' @($classes)
            Set-ObjectProperty $old 'updatedAt' (Get-UnixTime)
            $byKey[$key] = $old
        }
    }
    $spells = @($byKey.Values | Sort-Object @{Expression={ [int](Get-ObjectProperty $_ 'level' 0) }}, @{Expression={ [string](Get-ObjectProperty $_ 'name' '') }})
    if ($spells.Count -gt 0 -or (Test-Path $CustomSpellLibraryFile)) { Save-CustomSpellLibrary $spells }
    return $spells
}

function Update-CustomSpellLibraryFromState($State) {
    if ($null -eq $State) { return @(Get-CustomSpellLibrary) }
    $players = @(Get-ObjectProperty $State 'players' @())
    $spells = @(Update-CustomSpellLibraryFromCharacters $players)
    return $spells
}


function Set-ObjectProperty($Object, [string]$Name, $Value) {
    if ($null -ne $Object.PSObject.Properties[$Name]) {
        $Object.$Name = $Value
    } else {
        $Object | Add-Member -NotePropertyName $Name -NotePropertyValue $Value
    }
}

function Merge-NewerCharacterProfiles($Incoming, $Current) {
    if ($null -eq $Incoming -or $null -eq $Current -or $null -eq $Incoming.players -or $null -eq $Current.players) { return }
    $profileFields = @('name','portrait','sheet','playerEditable','stats','profileUpdatedAt')
    foreach ($incomingPlayer in @($Incoming.players)) {
        $currentPlayer = @($Current.players) | Where-Object { [string]$_.id -eq [string]$incomingPlayer.id } | Select-Object -First 1
        if ($null -eq $currentPlayer) { continue }
        $oldTs = 0.0
        $newTs = 0.0
        if ($null -ne $currentPlayer.PSObject.Properties['profileUpdatedAt']) { [double]::TryParse([string]$currentPlayer.profileUpdatedAt, [ref]$oldTs) | Out-Null }
        if ($null -ne $incomingPlayer.PSObject.Properties['profileUpdatedAt']) { [double]::TryParse([string]$incomingPlayer.profileUpdatedAt, [ref]$newTs) | Out-Null }
        if ($oldTs -gt $newTs) {
            foreach ($field in $profileFields) {
                if ($null -ne $currentPlayer.PSObject.Properties[$field]) {
                    Set-ObjectProperty $incomingPlayer $field $currentPlayer.$field
                }
            }
        }
    }
}

function Get-MimeType([string]$Path) {
    switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
        '.html' { return 'text/html; charset=utf-8' }
        '.css'  { return 'text/css; charset=utf-8' }
        '.js'   { return 'application/javascript; charset=utf-8' }
        '.json' { return 'application/json; charset=utf-8' }
        '.png'  { return 'image/png' }
        '.jpg'  { return 'image/jpeg' }
        '.jpeg' { return 'image/jpeg' }
        '.gif'  { return 'image/gif' }
        '.webp' { return 'image/webp' }
        '.svg'  { return 'image/svg+xml' }
        '.mp3'  { return 'audio/mpeg' }
        '.wav'  { return 'audio/wav' }
        '.ogg'  { return 'audio/ogg' }
        '.m4a'  { return 'audio/mp4' }
        '.aac'  { return 'audio/aac' }
        '.flac' { return 'audio/flac' }
        '.opus' { return 'audio/ogg' }
        '.mp4'  { return 'video/mp4' }
        '.webm' { return 'video/webm' }
        '.mkv'  { return 'video/x-matroska' }
        '.mov'  { return 'video/quicktime' }
        '.pdf'  { return 'application/pdf' }
        default { return 'application/octet-stream' }
    }
}

function Get-StatusText([int]$Code) {
    switch ($Code) {
        200 { 'OK' }
        201 { 'Created' }
        206 { 'Partial Content' }
        400 { 'Bad Request' }
        403 { 'Forbidden' }
        404 { 'Not Found' }
        413 { 'Payload Too Large' }
        500 { 'Internal Server Error' }
        default { 'OK' }
    }
}

function Send-Bytes($Stream, [int]$Status, [string]$ContentType, [byte[]]$Body, [string]$CacheControl = 'no-store') {
    if ($null -eq $Body) { $Body = New-Object byte[] 0 }
    $head = "HTTP/1.1 $Status $(Get-StatusText $Status)`r`n" +
            "Content-Type: $ContentType`r`n" +
            "Content-Length: $($Body.Length)`r`n" +
            "Cache-Control: $CacheControl`r`n" +
            "Connection: close`r`n`r`n"
    $headBytes = $Utf8.GetBytes($head)
    $Stream.Write($headBytes, 0, $headBytes.Length)
    if ($Body.Length -gt 0) { $Stream.Write($Body, 0, $Body.Length) }
    $Stream.Flush()
}

function Send-Text($Stream, [int]$Status, [string]$ContentType, [string]$Text) {
    Send-Bytes $Stream $Status $ContentType ($Utf8.GetBytes($Text))
}

function Send-Json($Stream, $Payload, [int]$Status = 200) {
    $json = $Payload | ConvertTo-Json -Depth 50 -Compress
    Send-Text $Stream $Status 'application/json; charset=utf-8' $json
}

function Send-ErrorJson($Stream, [string]$Message, [int]$Status = 400) {
    Send-Json $Stream ([pscustomobject]@{ ok = $false; error = $Message }) $Status
}

function Test-ClientDisconnectError($Exception) {
    $current = $Exception
    while ($null -ne $current) {
        $message = [string]$current.Message
        if ($message -match '(?i)(transport connection|connection was aborted|forcibly closed|broken pipe|connection reset|software in your host machine|client disconnected)') {
            return $true
        }
        $current = $current.InnerException
    }
    return $false
}

function Read-Request($Stream) {
    $headerList = New-Object 'System.Collections.Generic.List[byte]'
    $tail = New-Object 'System.Collections.Generic.Queue[byte]'
    $one = New-Object byte[] 1
    $found = $false
    while ($headerList.Count -lt 65536) {
        $n = $Stream.Read($one, 0, 1)
        if ($n -le 0) { break }
        $b = $one[0]
        $headerList.Add($b)
        $tail.Enqueue($b)
        while ($tail.Count -gt 4) { [void]$tail.Dequeue() }
        if ($tail.Count -eq 4) {
            $arr = $tail.ToArray()
            if ($arr[0] -eq 13 -and $arr[1] -eq 10 -and $arr[2] -eq 13 -and $arr[3] -eq 10) {
                $found = $true
                break
            }
        }
    }
    if (-not $found) { return $null }

    $headerBytes = $headerList.ToArray()
    $headerText = [System.Text.Encoding]::ASCII.GetString($headerBytes)
    $lines = $headerText -split "`r`n"
    if ($lines.Count -lt 1) { return $null }
    $parts = $lines[0].Split(' ')
    if ($parts.Count -lt 2) { return $null }

    $headers = @{}
    for ($i = 1; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $idx = $line.IndexOf(':')
        if ($idx -gt 0) {
            $headers[$line.Substring(0, $idx).Trim()] = $line.Substring($idx + 1).Trim()
        }
    }

    $length = 0
    if ($headers.ContainsKey('Content-Length')) { [void][int]::TryParse($headers['Content-Length'], [ref]$length) }
    if ($length -gt 314572800) { throw 'Payload exceeds 300 MB maximum.' }
    $body = New-Object byte[] $length
    $offset = 0
    while ($offset -lt $length) {
        $n = $Stream.Read($body, $offset, $length - $offset)
        if ($n -le 0) { break }
        $offset += $n
    }
    if ($offset -lt $length) { throw 'Request body ended unexpectedly.' }

    return [pscustomobject]@{
        Method = $parts[0].ToUpperInvariant()
        RawPath = $parts[1]
        Headers = $headers
        Body = $body
    }
}

function Get-SafeFilename([string]$Name) {
    $nameOnly = [System.IO.Path]::GetFileName($Name)
    $safe = [regex]::Replace($nameOnly, '[^A-Za-z0-9._-]+', '-')
    $safe = $safe.Trim([char[]]@('.', '-'))
    if ([string]::IsNullOrWhiteSpace($safe)) { $safe = 'file' }
    $id = [Guid]::NewGuid().ToString('N').Substring(0,8)
    return "$id-$safe"
}

function Get-LibraryConfig {
    $config = @{}
    foreach ($key in $LibraryDefs.Keys) { $config[$key] = '' }
    if (Test-Path -LiteralPath $LibraryConfigFile -PathType Leaf) {
        try {
            $raw = Get-Content -LiteralPath $LibraryConfigFile -Raw -Encoding UTF8 | ConvertFrom-Json
            foreach ($key in $LibraryDefs.Keys) {
                $prop = $raw.PSObject.Properties[$key]
                if ($null -ne $prop) { $config[$key] = ([string]$prop.Value).Trim() }
            }
        } catch { }
    }
    return $config
}

function Save-LibraryConfig($Paths) {
    $clean = [ordered]@{}
    foreach ($key in $LibraryDefs.Keys) {
        $value = ''
        if ($null -ne $Paths) {
            if ($Paths -is [System.Collections.IDictionary] -and $Paths.Contains($key)) {
                $value = [string]$Paths[$key]
            } elseif ($null -ne $Paths.PSObject.Properties[$key]) {
                $value = [string]$Paths.PSObject.Properties[$key].Value
            }
        }
        $clean[$key] = $value.Trim()
    }
    $json = ([pscustomobject]$clean) | ConvertTo-Json -Depth 10
    $tmp = "$LibraryConfigFile.tmp"
    [System.IO.File]::WriteAllText($tmp, $json, $Utf8)
    Move-Item -LiteralPath $tmp -Destination $LibraryConfigFile -Force
}

function Get-LibraryRoot([string]$Key) {
    if (-not $LibraryDefs.Contains($Key)) { throw 'Unknown media library.' }
    $config = Get-LibraryConfig
    $configured = [string]$config[$Key]
    if (-not [string]::IsNullOrWhiteSpace($configured)) {
        $expanded = [Environment]::ExpandEnvironmentVariables($configured.Trim())
        return [System.IO.Path]::GetFullPath($expanded)
    }
    return [System.IO.Path]::GetFullPath((Join-Path $MediaDir $LibraryDefs[$Key].Folder))
}

function Get-LibraryPayload {
    $config = Get-LibraryConfig
    $libraries = @()
    foreach ($key in $LibraryDefs.Keys) {
        $root = Get-LibraryRoot $key
        $defaultPath = [System.IO.Path]::GetFullPath((Join-Path $MediaDir $LibraryDefs[$key].Folder))
        $libraries += [pscustomobject]@{
            key = $key
            label = [string]$LibraryDefs[$key].Label
            path = [string]$config[$key]
            effectivePath = $root
            defaultPath = $defaultPath
            exists = (Test-Path -LiteralPath $root -PathType Container)
        }
    }
    return [pscustomobject]@{ ok = $true; libraries = $libraries }
}

function Get-MediaKind([string]$Path) {
    switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
        '.mp4' { return 'video' }; '.webm' { return 'video' }; '.ogv' { return 'video' }; '.mkv' { return 'video' }; '.mov' { return 'video' }
        '.png' { return 'image' }; '.jpg' { return 'image' }; '.jpeg' { return 'image' }; '.gif' { return 'image' }; '.webp' { return 'image' }; '.svg' { return 'image' }
        '.mp3' { return 'audio' }; '.wav' { return 'audio' }; '.ogg' { return 'audio' }; '.m4a' { return 'audio' }; '.aac' { return 'audio' }; '.flac' { return 'audio' }; '.opus' { return 'audio' }
        '.pdf' { return 'pdf' }
        default { return '' }
    }
}

function Convert-ToUrlRelativePath([string]$RelativePath) {
    $normalized = $RelativePath.Replace('\','/').Trim('/')
    if ([string]::IsNullOrWhiteSpace($normalized)) { return '' }
    $segments = @()
    foreach ($part in $normalized.Split('/')) {
        if (-not [string]::IsNullOrWhiteSpace($part)) { $segments += [Uri]::EscapeDataString($part) }
    }
    return ($segments -join '/')
}

function Get-RelativeLibraryPath([string]$Root, [string]$FullPath) {
    $rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd([char[]]@('\','/'))
    $itemFull = [System.IO.Path]::GetFullPath($FullPath)
    $base = $rootFull + [System.IO.Path]::DirectorySeparatorChar
    if (-not $itemFull.StartsWith($base, [StringComparison]::OrdinalIgnoreCase)) { throw 'Path is outside the configured library.' }
    return $itemFull.Substring($base.Length).Replace('\','/')
}

function Get-SafeLibraryTarget([string]$Root, [string]$RelativePath) {
    $rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd([char[]]@('\','/'))
    $cleanRel = $RelativePath.Replace('/', [System.IO.Path]::DirectorySeparatorChar).TrimStart([char[]]@('\','/'))
    $target = [System.IO.Path]::GetFullPath((Join-Path $rootFull $cleanRel))
    $base = $rootFull + [System.IO.Path]::DirectorySeparatorChar
    if ($target -ne $rootFull -and -not $target.StartsWith($base, [StringComparison]::OrdinalIgnoreCase)) { throw 'Path is outside the configured library.' }
    return $target
}

function New-MediaItem([string]$Library, [string]$Root, $Item) {
    $relative = Get-RelativeLibraryPath $Root $Item.FullName
    $folder = [System.IO.Path]::GetDirectoryName($relative)
    if ($null -eq $folder -or $folder -eq '.') { $folder = '' } else { $folder = $folder.Replace('\','/') }
    return [pscustomobject]@{
        name = $Item.Name
        relativePath = $relative
        folder = $folder
        url = "/library/$([Uri]::EscapeDataString($Library))/$(Convert-ToUrlRelativePath $relative)"
        kind = Get-MediaKind $Item.FullName
        size = [long]$Item.Length
        library = $Library
    }
}

function Get-LibraryBrowse([string]$Library, [string]$CurrentPath = '', [string]$Search = '') {
    if (-not $LibraryDefs.Contains($Library)) { throw 'Unknown media library.' }
    $root = Get-LibraryRoot $Library
    $currentPath = ([string]$CurrentPath).Replace('\','/').Trim('/')
    $searchText = ([string]$Search).Trim().ToLowerInvariant()
    if (-not (Test-Path -LiteralPath $root -PathType Container)) {
        return [pscustomobject]@{ ok=$true; library=$Library; path=$currentPath; exists=$false; folders=@(); files=@(); root=$root; query=$searchText }
    }
    $allowed = @($LibraryDefs[$Library].Kinds)
    $current = if ([string]::IsNullOrWhiteSpace($currentPath)) { $root } else { Get-SafeLibraryTarget $root $currentPath }
    if (-not (Test-Path -LiteralPath $current -PathType Container)) { $current = $root; $currentPath = '' }
    $folders = @()
    $files = @()
    if (-not [string]::IsNullOrWhiteSpace($searchText)) {
        $count = 0
        Get-ChildItem -LiteralPath $root -File -Recurse -ErrorAction SilentlyContinue | Sort-Object FullName | ForEach-Object {
            if ($count -ge 600) { return }
            $kind = Get-MediaKind $_.FullName
            if ($kind -and $allowed -contains $kind) {
                $relative = Get-RelativeLibraryPath $root $_.FullName
                if ($relative.ToLowerInvariant().Contains($searchText)) {
                    $files += New-MediaItem $Library $root $_
                    $count++
                }
            }
        }
    } else {
        Get-ChildItem -LiteralPath $current -Directory -ErrorAction SilentlyContinue | Sort-Object Name | ForEach-Object {
            $folders += [pscustomobject]@{ name=$_.Name; path=(Get-RelativeLibraryPath $root $_.FullName) }
        }
        Get-ChildItem -LiteralPath $current -File -ErrorAction SilentlyContinue | Sort-Object Name | ForEach-Object {
            $kind = Get-MediaKind $_.FullName
            if ($kind -and $allowed -contains $kind) { $files += New-MediaItem $Library $root $_ }
        }
    }
    return [pscustomobject]@{ ok=$true; library=$Library; path=$currentPath; exists=$true; folders=$folders; files=$files; root=$root; query=$searchText }
}

function Get-QueryValue([string]$RawPath, [string]$Key) {
    $qIndex = $RawPath.IndexOf('?')
    if ($qIndex -lt 0) { return '' }
    $query = $RawPath.Substring($qIndex + 1)
    foreach ($pair in $query.Split('&')) {
        $eq = $pair.IndexOf('=')
        $k = if ($eq -ge 0) { $pair.Substring(0, $eq) } else { $pair }
        if ($k -eq $Key) {
            $v = if ($eq -ge 0) { $pair.Substring($eq + 1) } else { '' }
            return [Uri]::UnescapeDataString($v.Replace('+', ' '))
        }
    }
    return ''
}

function Get-RoutePath([string]$RawPath) {
    $qIndex = $RawPath.IndexOf('?')
    $path = if ($qIndex -ge 0) { $RawPath.Substring(0, $qIndex) } else { $RawPath }
    return [Uri]::UnescapeDataString($path)
}

function Serve-File($Stream, [string]$FilePath, $RequestHeaders = $null, [bool]$HeadOnly = $false) {
    if (-not (Test-Path -LiteralPath $FilePath -PathType Leaf)) {
        Send-Text $Stream 404 'text/plain; charset=utf-8' 'Not Found'
        return
    }
    $info = Get-Item -LiteralPath $FilePath
    [long]$total = $info.Length
    [long]$start = 0
    [long]$end = [Math]::Max(0, $total - 1)
    [int]$status = 200
    $contentType = Get-MimeType $FilePath
    $isStreamMedia = $contentType.StartsWith('video/') -or $contentType.StartsWith('audio/')
    $rangeHeader = ''
    if ($null -ne $RequestHeaders -and $RequestHeaders.ContainsKey('Range')) { $rangeHeader = [string]$RequestHeaders['Range'] }
    if ($rangeHeader -match '^bytes=(\d*)-(\d*)') {
        $a = $Matches[1]
        $b = $Matches[2]
        if (-not [string]::IsNullOrWhiteSpace($a)) {
            $start = [Math]::Max(0, [long]$a)
            if (-not [string]::IsNullOrWhiteSpace($b)) {
                $end = [Math]::Min($total - 1, [long]$b)
            } elseif ($isStreamMedia -and $total -gt 0) {
                # Chrome/Edge commonly ask for "bytes=N-". Sending the entire rest of
                # a multi-GB map here blocks the dependency-free PowerShell listener.
                # Return a short standards-compliant 206 chunk; the media element will
                # request the next chunk as needed.
                $end = [Math]::Min($total - 1, $start + [long]$MediaStreamChunkBytes - 1)
            }
        } elseif (-not [string]::IsNullOrWhiteSpace($b)) {
            [long]$suffix = [Math]::Min($total, [long]$b)
            if ($isStreamMedia) { $suffix = [Math]::Min($suffix, [long]$MediaStreamChunkBytes) }
            $start = $total - $suffix
        }
        if ($start -le $end -and $end -lt $total) { $status = 206 }
    }
    [long]$length = if ($total -gt 0) { $end - $start + 1 } else { 0 }
    $cache = if ($contentType.StartsWith('text/')) { 'no-cache' } else { 'public, max-age=3600' }
    $extra = "Accept-Ranges: bytes`r`n"
    if ($status -eq 206) { $extra += "Content-Range: bytes $start-$end/$total`r`n" }
    $head = "HTTP/1.1 $status $(Get-StatusText $status)`r`n" +
            "Content-Type: $contentType`r`n" +
            "Content-Length: $length`r`n" +
            $extra +
            "Cache-Control: $cache`r`n" +
            "Connection: close`r`n`r`n"
    $headBytes = $Utf8.GetBytes($head)
    $Stream.Write($headBytes, 0, $headBytes.Length)
    if ($HeadOnly -or $length -le 0) { $Stream.Flush(); return }
    $fs = [System.IO.File]::Open($FilePath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
    try {
        [void]$fs.Seek($start, [System.IO.SeekOrigin]::Begin)
        $buffer = New-Object byte[] 131072
        [long]$remaining = $length
        while ($remaining -gt 0) {
            $want = [int][Math]::Min([long]$buffer.Length, $remaining)
            $n = $fs.Read($buffer, 0, $want)
            if ($n -le 0) { break }
            $Stream.Write($buffer, 0, $n)
            $remaining -= $n
        }
    }
    finally { $fs.Dispose() }
    $Stream.Flush()
}

function Get-LanAddresses {
    $result = New-Object System.Collections.Generic.List[string]
    try {
        foreach ($nic in [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) {
            if ($nic.OperationalStatus -ne [System.Net.NetworkInformation.OperationalStatus]::Up) { continue }
            if ($nic.NetworkInterfaceType -eq [System.Net.NetworkInformation.NetworkInterfaceType]::Loopback) { continue }
            $props = $nic.GetIPProperties()
            $hasGateway = $false
            foreach ($gw in $props.GatewayAddresses) {
                if ($null -ne $gw.Address -and $gw.Address.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and [string]$gw.Address -ne '0.0.0.0') { $hasGateway = $true; break }
            }
            if (-not $hasGateway) { continue }
            foreach ($ua in $props.UnicastAddresses) {
                $a = $ua.Address
                if ($null -eq $a -or $a.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) { continue }
                $ip = [string]$a
                if ($ip.StartsWith('127.') -or $ip.StartsWith('169.254.')) { continue }
                if (-not $result.Contains($ip)) { $result.Add($ip) }
            }
        }
    } catch { }
    if ($result.Count -eq 0) {
        try {
            foreach ($a in [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName())) {
                if ($a.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) { continue }
                $ip = [string]$a
                if ($ip.StartsWith('127.') -or $ip.StartsWith('169.254.')) { continue }
                if (-not $result.Contains($ip)) { $result.Add($ip) }
            }
        } catch { }
    }
    return @($result)
}

function Invoke-HueRequest([string]$Method, [string]$Url, $Body = $null, $Headers = $null) {
    $params = @{
        Uri = $Url
        Method = $Method
        TimeoutSec = 6
        ErrorAction = 'Stop'
    }
    if ($null -ne $Headers) { $params['Headers'] = $Headers }
    if ($null -ne $Body) {
        $params['Body'] = ($Body | ConvertTo-Json -Depth 10 -Compress)
        $params['ContentType'] = 'application/json'
    }
    return Invoke-RestMethod @params
}

function Handle-Client($Client) {
    $stream = $Client.GetStream()
    # A browser abandoning a video seek should never pin the whole local server.
    try { $stream.ReadTimeout = 10000; $stream.WriteTimeout = 10000 } catch { }
    $req = Read-Request $stream
    if ($null -eq $req) { return }
    $path = Get-RoutePath $req.RawPath
    # /api/state is the normal screen-sync heartbeat and can fire several
    # times per second when Player/Tabletop outputs are open. Keep the
    # console useful by logging everything except that routine GET.
    if (-not ($req.Method -eq 'GET' -and $path -eq '/api/state')) {
        Write-Host ("[{0}] {1} {2}" -f (Get-Date -Format 'HH:mm:ss'), $req.Method, $path)
    }

    try {
        if ($req.Method -eq 'GET' -and $path -eq '/api/state') {
            Send-Json $stream (Get-State)
            return
        }

        if ($req.Method -eq 'GET' -and $path -eq '/api/network') {
            Send-Json $stream ([pscustomobject]@{ ok = $true; port = $Port; lanIps = @(Get-LanAddresses) })
            return
        }

        if ($req.Method -eq 'GET' -and $path -eq '/api/spell-library') {
            $spells = @(Update-CustomSpellLibraryFromState (Get-State))
            Send-Json $stream ([pscustomobject]@{ ok = $true; count = $spells.Count; spells = $spells })
            return
        }

        if ($req.Method -eq 'POST' -and $path -eq '/api/state') {
            $jsonText = $Utf8.GetString($req.Body)
            $state = $jsonText | ConvertFrom-Json
            $current = Get-State
            Merge-NewerCharacterProfiles $state $current
            Update-CustomSpellLibraryFromState $state | Out-Null
            Save-State $state
            Send-Json $stream ([pscustomobject]@{ ok = $true; updatedAt = $state.updatedAt })
            return
        }

        if ($req.Method -eq 'POST' -and $path -eq '/api/character') {
            $payload = $Utf8.GetString($req.Body) | ConvertFrom-Json
            $charId = [string]$payload.id
            if ([string]::IsNullOrWhiteSpace($charId)) { throw 'Character id is required.' }
            $state = Get-State
            $character = @($state.players) | Where-Object { [string]$_.id -eq $charId } | Select-Object -First 1
            if ($null -eq $character) { throw 'Character was not found.' }
            $editable = $false
            if ($null -ne $character.PSObject.Properties['playerEditable']) { $editable = [bool]$character.playerEditable }
            if (-not $editable) {
                Send-ErrorJson $stream 'Player editing is disabled for this character' 403
                return
            }
            if ($null -ne $payload.PSObject.Properties['name']) {
                $name = [string]$payload.name
                if (-not [string]::IsNullOrWhiteSpace($name)) { Set-ObjectProperty $character 'name' $name.Trim() }
            }
            if ($null -ne $payload.PSObject.Properties['portrait']) { Set-ObjectProperty $character 'portrait' ([string]$payload.portrait) }
            if ($null -ne $payload.PSObject.Properties['sheet']) {
                Set-ObjectProperty $character 'sheet' $payload.sheet
                if ($null -ne $payload.sheet.PSObject.Properties['stats']) { Set-ObjectProperty $character 'stats' $payload.sheet.stats }
            }
            Set-ObjectProperty $character 'profileUpdatedAt' (Get-UnixTime)
            if ($null -ne $state.PSObject.Properties['tabletop'] -and $null -ne $state.tabletop.PSObject.Properties['tokens']) {
                foreach ($token in @($state.tabletop.tokens)) {
                    if ([string]$token.entityType -eq 'player' -and [string]$token.entityId -eq $charId) {
                        Set-ObjectProperty $token 'name' ([string]$character.name)
                        $tokenImage = if ($null -ne $token.PSObject.Properties['image']) { [string]$token.image } else { '' }
                        $portrait = if ($null -ne $character.PSObject.Properties['portrait']) { [string]$character.portrait } else { '' }
                        if ([string]::IsNullOrWhiteSpace($tokenImage) -and -not [string]::IsNullOrWhiteSpace($portrait)) { Set-ObjectProperty $token 'image' $portrait }
                    }
                }
            }
            Update-CustomSpellLibraryFromCharacters @($character) | Out-Null
            Save-State $state
            Send-Json $stream ([pscustomobject]@{ ok = $true; character = $character })
            return
        }

        if ($req.Method -eq 'POST' -and $path -eq '/api/tabletop/metrics') {
            $payload = $Utf8.GetString($req.Body) | ConvertFrom-Json
            $width = [Math]::Max(0, [int]$payload.width)
            $height = [Math]::Max(0, [int]$payload.height)
            $state = Get-State
            if ($null -eq $state.PSObject.Properties['tabletop']) {
                $state | Add-Member -NotePropertyName tabletop -NotePropertyValue ([pscustomobject]@{})
            }
            if ($null -eq $state.tabletop.PSObject.Properties['outputWidth']) {
                $state.tabletop | Add-Member -NotePropertyName outputWidth -NotePropertyValue $width
            } else {
                $state.tabletop.outputWidth = $width
            }
            if ($null -eq $state.tabletop.PSObject.Properties['outputHeight']) {
                $state.tabletop | Add-Member -NotePropertyName outputHeight -NotePropertyValue $height
            } else {
                $state.tabletop.outputHeight = $height
            }
            $state.updatedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() / 1000.0
            Save-State $state
            Send-Json $stream ([pscustomobject]@{ ok = $true; width = $width; height = $height })
            return
        }

        if ($req.Method -eq 'POST' -and $path -eq '/api/libraries') {
            $payload = $Utf8.GetString($req.Body) | ConvertFrom-Json
            $paths = if ($null -ne $payload.PSObject.Properties['paths']) { $payload.paths } else { $payload }
            Save-LibraryConfig $paths
            Send-Json $stream (Get-LibraryPayload)
            return
        }

        if ($req.Method -eq 'POST' -and $path -eq '/api/upload') {
            $originalName = Get-QueryValue $req.RawPath 'name'
            if ([string]::IsNullOrWhiteSpace($originalName)) { throw 'No file name supplied.' }
            if ($req.Body.Length -eq 0) { throw 'No file selected.' }
            $filename = Get-SafeFilename $originalName
            $out = Join-Path $MediaDir $filename
            [System.IO.File]::WriteAllBytes($out, $req.Body)
            Send-Json $stream ([pscustomobject]@{ ok = $true; url = "/media/$filename"; name = $originalName })
            return
        }

        if ($req.Method -eq 'POST' -and $path -eq '/api/hue/pair') {
            $payload = $Utf8.GetString($req.Body) | ConvertFrom-Json
            $ip = [string]$payload.bridgeIp
            if ([string]::IsNullOrWhiteSpace($ip)) { throw 'Enter the bridge IP first.' }
            $response = Invoke-HueRequest 'POST' "https://$ip/api" ([pscustomobject]@{ devicetype = 'dm_control_room#local' })
            $successItem = $response | Where-Object { $null -ne $_.success } | Select-Object -First 1
            if ($null -eq $successItem -or [string]::IsNullOrWhiteSpace([string]$successItem.success.username)) {
                $errorItem = $response | Where-Object { $null -ne $_.error } | Select-Object -First 1
                $msg = if ($null -ne $errorItem) { [string]$errorItem.error.description } else { 'Pairing failed.' }
                throw $msg
            }
            $state = Get-State
            $state.hue.bridgeIp = $ip.Trim()
            $state.hue.appKey = [string]$successItem.success.username
            $state.hue.lastStatus = 'Paired'
            Save-State $state
            Send-Json $stream ([pscustomobject]@{ ok = $true; appKey = [string]$successItem.success.username })
            return
        }

        if ($req.Method -eq 'GET' -and $path -eq '/api/libraries') {
            Send-Json $stream (Get-LibraryPayload)
            return
        }

        if ($req.Method -eq 'GET' -and $path -eq '/api/media') {
            $library = Get-QueryValue $req.RawPath 'library'
            if ([string]::IsNullOrWhiteSpace($library)) { $library = 'maps' }
            $currentPath = Get-QueryValue $req.RawPath 'path'
            $search = Get-QueryValue $req.RawPath 'q'
            Send-Json $stream (Get-LibraryBrowse $library $currentPath $search)
            return
        }

        if ($req.Method -eq 'GET' -and $path -eq '/api/hue/scenes') {
            $state = Get-State
            $ip = [string]$state.hue.bridgeIp
            $key = [string]$state.hue.appKey
            if ([string]::IsNullOrWhiteSpace($ip) -or [string]::IsNullOrWhiteSpace($key)) { throw 'Hue is not paired.' }
            $response = Invoke-HueRequest 'GET' "https://$ip/clip/v2/resource/scene" $null @{ 'hue-application-key' = $key }
            $scenes = @()
            foreach ($item in $response.data) {
                $scenes += [pscustomobject]@{ id = [string]$item.id; name = [string]$item.metadata.name }
            }
            Send-Json $stream ([pscustomobject]@{ ok = $true; scenes = $scenes })
            return
        }

        if ($req.Method -eq 'POST' -and $path -eq '/api/hue/recall') {
            $payload = $Utf8.GetString($req.Body) | ConvertFrom-Json
            $sceneId = [string]$payload.sceneId
            if ([string]::IsNullOrWhiteSpace($sceneId)) { throw 'No Hue scene ID selected.' }
            $state = Get-State
            $ip = [string]$state.hue.bridgeIp
            $key = [string]$state.hue.appKey
            if ([string]::IsNullOrWhiteSpace($ip) -or [string]::IsNullOrWhiteSpace($key)) { throw 'Hue is not paired.' }
            $body = [pscustomobject]@{ recall = [pscustomobject]@{ action = 'active' } }
            $response = Invoke-HueRequest 'PUT' "https://$ip/clip/v2/resource/scene/$sceneId" $body @{ 'hue-application-key' = $key }
            $state.hue.lastStatus = 'Scene recalled'
            Save-State $state
            Send-Json $stream ([pscustomobject]@{ ok = $true; response = $response })
            return
        }

        if (($req.Method -eq 'GET' -or $req.Method -eq 'HEAD') -and ($path -eq '/' -or $path -eq '/dm' -or $path -eq '/dm.html')) {
            Serve-File $stream (Join-Path $Root 'dm.html') $req.Headers ($req.Method -eq 'HEAD')
            return
        }
        if (($req.Method -eq 'GET' -or $req.Method -eq 'HEAD') -and ($path -eq '/player' -or $path -eq '/player.html')) {
            Serve-File $stream (Join-Path $Root 'player.html') $req.Headers ($req.Method -eq 'HEAD')
            return
        }
        if (($req.Method -eq 'GET' -or $req.Method -eq 'HEAD') -and ($path -eq '/tabletop' -or $path -eq '/tabletop.html')) {
            Serve-File $stream (Join-Path $Root 'tabletop.html') $req.Headers ($req.Method -eq 'HEAD')
            return
        }
        if (($req.Method -eq 'GET' -or $req.Method -eq 'HEAD') -and $path -eq '/README.md') {
            Serve-File $stream (Join-Path $Root 'README.md') $req.Headers ($req.Method -eq 'HEAD')
            return
        }
        if (($req.Method -eq 'GET' -or $req.Method -eq 'HEAD') -and $path.StartsWith('/library/')) {
            $rest = $path.Substring('/library/'.Length)
            $slash = $rest.IndexOf('/')
            if ($slash -le 0) {
                Send-Text $stream 404 'text/plain; charset=utf-8' 'Not Found'
                return
            }
            $library = $rest.Substring(0, $slash)
            $relative = $rest.Substring($slash + 1)
            if (-not $LibraryDefs.Contains($library)) {
                Send-Text $stream 404 'text/plain; charset=utf-8' 'Not Found'
                return
            }
            $root = Get-LibraryRoot $library
            $target = Get-SafeLibraryTarget $root $relative
            Serve-File $stream $target $req.Headers ($req.Method -eq 'HEAD')
            return
        }

        if (($req.Method -eq 'GET' -or $req.Method -eq 'HEAD') -and $path.StartsWith('/media/')) {
            $relative = $path.Substring('/media/'.Length).Replace('/', [System.IO.Path]::DirectorySeparatorChar)
            $target = [System.IO.Path]::GetFullPath((Join-Path $MediaDir $relative))
            $base = [System.IO.Path]::GetFullPath($MediaDir) + [System.IO.Path]::DirectorySeparatorChar
            if (-not $target.StartsWith($base, [StringComparison]::OrdinalIgnoreCase)) {
                Send-Text $stream 403 'text/plain; charset=utf-8' 'Forbidden'
            } else {
                Serve-File $stream $target $req.Headers ($req.Method -eq 'HEAD')
            }
            return
        }
        if (($req.Method -eq 'GET' -or $req.Method -eq 'HEAD') -and $path.StartsWith('/static/')) {
            $relative = $path.Substring(1).Replace('/', [System.IO.Path]::DirectorySeparatorChar)
            $target = [System.IO.Path]::GetFullPath((Join-Path $Root $relative))
            $base = [System.IO.Path]::GetFullPath($Root) + [System.IO.Path]::DirectorySeparatorChar
            if (-not $target.StartsWith($base, [StringComparison]::OrdinalIgnoreCase)) {
                Send-Text $stream 403 'text/plain; charset=utf-8' 'Forbidden'
            } else {
                Serve-File $stream $target $req.Headers ($req.Method -eq 'HEAD')
            }
            return
        }

        Send-Text $stream 404 'text/plain; charset=utf-8' 'Not Found'
    }
    catch {
        # Browsers intentionally cancel media range requests after they have enough
        # metadata, or when a thumbnail scrolls out of view. Windows surfaces that
        # as an IOException such as "connection was aborted by the software in your
        # host machine". It is normal and should not be shown as an app error.
        if (Test-ClientDisconnectError $_.Exception) { return }
        $message = $_.Exception.Message
        Write-Host "ERROR: $message" -ForegroundColor Red
        try { Send-ErrorJson $stream $message 400 } catch { }
    }
}

Ensure-StateFile
$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $Port)
try {
    $listener.Start()
    Write-Host ''
    Write-Host 'DM Control Room' -ForegroundColor Cyan
    Write-Host "DM screen:     http://localhost:$Port"
    Write-Host "Player screen: http://localhost:$Port/player"
    Write-Host "Tabletop:      http://localhost:$Port/tabletop"
    Write-Host "Player table:  http://localhost:$Port/tabletop?share=1"
    Write-Host ''
    Write-Host 'The server is running. Leave this window open while you play.'
    Write-Host 'For another device on the same network, use this computer''s LAN IP.'
    Write-Host 'Close this window to stop the server.'
    Write-Host ''

    while ($true) {
        $client = $listener.AcceptTcpClient()
        try { Handle-Client $client }
        catch {
            if (-not (Test-ClientDisconnectError $_.Exception)) {
                Write-Host $_.Exception.Message -ForegroundColor Red
            }
        }
        finally { $client.Close() }
    }
}
finally {
    $listener.Stop()
}
