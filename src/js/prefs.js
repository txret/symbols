import Gio from 'gi://Gio'
import Adw from 'gi://Adw'

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js'


export default class SymbolsPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'dialog-information-symbolic',
        })
        window.add(page)
        const group = new Adw.PreferencesGroup({})
        page.add(group)

        window._settings = this.getSettings()

        // max entries
        let row = Adw.SpinRow.new_with_range(1,50, 1)
        row.set_title(_('Maximum number of rows shown'))
        window._settings.bind('rows', row, 'value', Gio.SettingsBindFlags.DEFAULT)
        group.add(row)

        // menu width
        row = Adw.SpinRow.new_with_range(50,1000, 1)
        row.set_title(_('Popup width (pixels'))
        window._settings.bind('width', row, 'value', Gio.SettingsBindFlags.DEFAULT)
        group.add(row)

        // Font size
        row = Adw.SpinRow.new_with_range(6,100, 1)
        row.set_title(_('Font size (pixels)'))
        window._settings.bind('font-size', row, 'value', Gio.SettingsBindFlags.DEFAULT)
        group.add(row)

        // Shortcut
        row = new Adw.ActionRow()
        row.set_title(_('Shortcut to open symbol picker'))
        group.add(row)
        const shortcut = new Gtk.Entry({ text: window._settings.get_string('shortcut') })
        shortcut.connect('changed', (entry) => window._settings.set_string('shortcut', entry.get_text()))
        row.add_suffix(shortcut)
        row.activatable_widget = shortcut
    }
}