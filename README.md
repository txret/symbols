# Symbols

GNOME extension to open a fuzzy search pick-list for inserting user defined symbols under Wayland by simulating Ctrl+V and Shift+Ctrl+V. Reads list from `~/.symbols` and expects the format `<symbol(s)>\t<key words>`. Insert currently selected symbol by pressing Enter (uses Ctrl+v) or Shift+Enter (uses Shift+Ctrl+v), alternatively left mouse click without or with Shift. Close pick list without insertion using Escape or mouse click outside the list.

**Note**: Uses clipboard + paste to insert symbol (I know of no other way to do this under Wayland) which will mess with your clipboard history even though it tries to restore the preceding item in the clipboard.

## Configuration

- `./symbols`: user text file with one symbol(s) per row, starting with the symbol(s) to be inserted then followed by tab then all keywords, e.g. `🙂\tsmile happy face smiley`.
- `rows`: GNOME extension setting for the max number of rows visible in the pick list.
- `width`: GNOME extension setting for the width of the pick list in pixels.
- `font-size`: GNOME extension setting for the font size in the pick list in pixels.
- `shortcut`: GNOME extension setting for the keyboard shortcut to activate the pick list.

## Credits

Uses [fuzzaldrinPlus](https://github.com/jeancroy/fuzz-aldrin-plus) for the fuzzy search.