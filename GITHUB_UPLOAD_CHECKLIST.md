# GitHub Upload Checklist

1. Create a new empty GitHub repository.
2. Extract this package and upload/commit the **contents of the `dm_control_room` folder**.
3. Before committing, run `git status` and confirm these are **not** included:
   - `data/state.json`
   - `data/custom_spells.json`
   - `data/library_config.json`
   - local files under `media/`
   - character PDFs, downloaded videos, purchased maps, music, API keys, or personal paths
4. Keep `NOTICE.md`, `LICENSE`, and `.gitignore` in the repository root.
5. Keep the project free if you rely on Wizards setting material under the Fan Content Policy.
6. For public releases, build release archives from a clean checkout rather than zipping your live campaign folder.

`data/default_state.json` intentionally contains the **Shadows of the Misty Forest** text-only demo campaign. It contains no bundled maps, art, audio, credentials, or imported D&D Beyond content.
