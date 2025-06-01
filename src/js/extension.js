import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js'
import * as Main from 'resource:///org/gnome/shell/ui/main.js'
import * as Dialog from 'resource:///org/gnome/shell/ui/dialog.js'
import St from 'gi://St'
import Clutter from 'gi://Clutter'
import GObject from 'gi://GObject'
import Shell from 'gi://Shell'
import Meta from 'gi://Meta'
import GLib from 'gi://GLib'
import Pango from 'gi://Pango'
import fuzzaldrin from './fuzzaldrinPlus.js'

function center_actor(actor) {
    const monitor = Main.layoutManager.monitors[global.display.get_focus_window()?.get_monitor() || 0]
    actor.set_position(
        monitor.x + Math.floor((monitor.width - actor.width) / 2),
        monitor.y + Math.floor((monitor.height - actor.height) / 2)
    )
}

/**
 * A fuzzy virtual list widget for filtering and selecting items.
 */
var FuzzyPicklist = GObject.registerClass(
class FuzzyPicklist extends St.BoxLayout {
    constructor(config = {}) {
        config = Object.assign({
            hint: 'Filter...',
            rows: 15,
            width: 400,
            scrollbar_width: 6,
            font_size: 14
        }, config)
        super({
            style_class: 'osd-window fuzzy-picklist-window',
            style: `font-size: ${config.font_size}px`,
            vertical: true,
            x_expand: true,
            reactive: true,
            can_focus: false,
            visible: false
        })
        this.config = config
        this.focus = null // global stage key focus connection
        this.items = [] // array of items to filter
        this.matches = [] // array of filtered items
        this.offset = 0 // offset of first visible item

        // main vertical container
        this.set_size(config.width, -1)

        // search entry
        this.search = new St.Entry({
            style_class: 'fuzzy-picklist-search', 
            //style: 'border: 1px solid yellow;',
            hint_text: config.hint,
            reactive: true,
            can_focus: true
        })
        this.add_child(this.search)

        // item list + scrollbar
        this.list = new St.BoxLayout({
            style_class: 'fuzzy-picklist-layout', 
            //style: 'border: 1px solid green;',
            vertical: false
        })
        this.add_child(this.list)

        // vertical list of labels
        this.list_content = new St.BoxLayout({
            style_class: 'fuzzy-picklist-layout', 
            //style: 'border: 1px solid blue;',
            vertical: true,
            x_expand: true
        })
        for (let i = 0; i < config.rows; i++) {
            let itm = new St.Label({
                style_class: 'fuzzy-picklist-item',
                //style: 'border: 1px solid red;',
                reactive:true,
                text: ''
             })
            itm.hide()
            itm.connect('button-press-event', (actor, event) => this.activate(itm, this.modifiers(event)))
            this.list_content.add_child(itm)
        }
        this.list.add_child(this.list_content)

        // fake scrollbar
        this.scrollbar = new St.DrawingArea({
            style_class: 'fuzzy-picklist-scrollbar',
            //style: 'border: 1px solid cyan;',
            visible: false
        })
        this.scrollbar.set_width(config.scrollbar_width)
        this.list.add_child(this.scrollbar)

        // set up event handlers
        this.search.clutter_text.connect('activate', () => this.activate(null, new Set()))

        this.search.connect('key-press-event', (entry, event) => {
            const key = event.get_key_symbol()
            const mods = this.modifiers(event)
            //log(`[symbols] Key pressed: ${key}`)
            if (key === Clutter.KEY_Escape) this.hide()
            else if (key === Clutter.KEY_Up) this.scroll('up')
            else if (key === Clutter.KEY_Down) this.scroll('down')
            else if (key === Clutter.KEY_Page_Up) this.scroll('pageup')
            else if (key === Clutter.KEY_Page_Down) this.scroll('pagedown')
            else if (key === Clutter.KEY_Home && mods.size === 1 && mods.has('ctrl')) this.scroll('home')
            else if (key === Clutter.KEY_End && mods.size === 1 && mods.has('ctrl')) this.scroll('end')
            // only fires when modifier(s) are pressed, otherwise activate is fired instead
            else if (key === Clutter.KEY_Return || key === Clutter.KEY_ISO_Enter) this.activate(null, mods)
            else return Clutter.EVENT_PROPAGATE
            
            return Clutter.EVENT_STOP
        })

        this.search.clutter_text.connect('text-changed', () => {
            const txt = this.search.get_text().trim()
            this.matches = txt ? fuzzaldrin.filter(this.items, txt) : this.items
            this.update(0, 'first')
        })

        this.connect('scroll-event', (actor, event) => {
            this.scroll(event.get_scroll_direction() === Clutter.ScrollDirection.UP)
            return Clutter.EVENT_STOP
        })

        Main.uiGroup.add_child(this)
    }

    modifiers(evt) {
        const mods = new Set()
        const state = evt.get_state()
        if (state & Clutter.ModifierType.SHIFT_MASK) mods.add('shift')
        if (state & Clutter.ModifierType.CONTROL_MASK) mods.add('ctrl')
        if (state & Clutter.ModifierType.MOD1_MASK) mods.add('alt')
        if (state & Clutter.ModifierType.META_MASK) mods.add('meta')
        return mods
    }

    activate(item, modifiers) {
        //log(`[symbols] activate called with item: ${item}, modifiers: ${modifiers}`)
        if (this.config.onselect) {
            this.hide()
            item ||= this.list_content.get_children().find(itm => itm.has_style_pseudo_class('selected'))
            if (item) {
                //log(`[symbols] Item selected: ${item.get_text()}, modifiers: ${modifiers}`)
                this.config.onselect(item.get_text(), modifiers)
                return Clutter.EVENT_STOP
            }
        }
        return Clutter.EVENT_PROPAGATE
    }

    show(items) {
        // setup
        this.items = items
        this.matches = items
        this.search.set_text('')
        const window = global.display.get_focus_window()
        //log(`showing fuzzy list with ${items.length} items, focused window: ${window ? window.title : 'none'}`)
        if (!items.length || !window) return
        this.update(0, 'first')

        // unfortunately there is no way of finding out where the cursor is, or if it is even in a text input so we center
        center_actor(this)

        // FIXME: update scroll tab size and position

        super.show()

        // grab keyboard+pointer and subscribe to global mouse events for a “popup”-style modal
        global.stage.set_key_focus(this.search)
        this.focus = global.stage.connect('notify::key-focus', () => {
            //log(`[symbols] key-focus event`)
            const target = global.stage.get_key_focus()
            if (!target || !this.contains(global.stage.get_key_focus())) this.hide()
        })
    }

    hide() {
        if (this.focus) {
            global.stage.disconnect(this.focus)
            this.focus = null
        }
        super.hide()
    }

    update(offset, select) {
        //log(`[symbols] update called with offset: ${offset}, select: ${select}, matches: ${this.matches.length}`)
        this.offset = offset
        const lis = this.list_content.get_children()
        for (const [i, li] of lis.entries()) {
            if (i + offset < this.matches.length) {
                li.text = this.matches[i + offset]
                li.show()
            } else {
                li.hide()
            }
            li.remove_style_pseudo_class('selected')
        }
        if (this.matches.length) {
            const ix = select === 'first'
                ? 0
                : Math.floor(lis.length - 1, this.matches.length - offset - 1)
            lis[ix].add_style_pseudo_class('selected')
        }

        // FIXME: update scroll tab size and position
    }

    scroll(direction) {
        //log(`[symbols] scroll called, direction: ${direction}`)
        if (!this.matches.length) return
        const lis = this.list_content.get_children()
        const ix = lis.findIndex(li => li.has_style_pseudo_class('selected'))
        if (direction === 'up') {
            if (ix === 0) {
                if (this.offset === 0) return
                this.update(this.offset - 1, 'first')
            } else {
                lis[ix].remove_style_pseudo_class('selected')
                lis[ix - 1].add_style_pseudo_class('selected')
            }
        } else if (direction === 'down') {
            if (ix === lis.length - 1) {
                if (this.offset + lis.length >= this.matches.length) return
                this.update(this.offset + 1, 'last')
            } else {
                lis[ix].remove_style_pseudo_class('selected')
                lis[ix + 1].add_style_pseudo_class('selected')
            }
        } else if (direction === 'pageup') {
            if (ix) {
                lis[ix].remove_style_pseudo_class('selected')
                lis[0].add_style_pseudo_class('selected')
            } else if (this.offset > 0) {
                this.update(Math.max(0, this.offset - lis.length + 1), 'first')
            }
        } else if (direction === 'pagedown') {
            if (ix < lis.length - 1) {
                lis[ix].remove_style_pseudo_class('selected')
                lis[lis.length - 1].add_style_pseudo_class('selected')
            } else if (this.offset + lis.length < this.matches.length) {
                this.update(this.offset + lis.length - 1, 'last')
            }
        } else if (direction === 'home' && this.offset && ix) {
            this.update(0, 'first')
        } else if (direction === 'end' && ix < lis.length - 1) {
            this.update(Math.max(0, this.matches.length - lis.length), 'last')
        }
    }
}
)

export default class InsertSymbol extends Extension {
    enable() {
        //log('[symbols] enabling extension')
        // load symbols from ~/.symbols in format "symbol\tdescription"
        let hint
        const path = GLib.build_filenamev([GLib.get_home_dir(), '.symbols'])
        try {
            const [ok, contents] = GLib.file_get_contents(path);
            this.items = contents.toString().split('\n').map(line => line.trim()).filter(line => line.length > 0)
            hint = 'Search symbols...'
        } catch (e) {
            logError(e, '[symbols] Failed to load ~/.symbols')
            this.items = ["🤨	face_with_raised_eyebrow, face, distrust, scepticism, disapproval, disbelief, surprise, suspicious, colbert, mild, one, rock, skeptic"]
            hint = 'Unable to load ~/.symbols'

            // warn user
            const widget = new St.Widget({ style: 'margin: 0px; padding: 0px;', reactive: true })
            Main.uiGroup.add_child(widget)
            const dialog = new Dialog.Dialog(widget, 'modal-dialog')
            const box = new St.BoxLayout({ vertical: true, style_class: 'modal-dialog-content-box' })
            dialog.contentLayout.add_child(box)
            const title = new St.Label({
                text: 'Insert symbol warning',
                style: 'font-weight: bold; padding-bottom: 10px; text-align: center;',
                x_align: Clutter.ActorAlign.FILL,
                x_expand: true
            })
            box.add_child(title)
            const label = new St.Label({
                text: 'Unable to load ~/.symbols! Should be a plain text file with one symbol set per line in the format "symbol(s)\\tdescription/search words".',
                style: 'padding-bottom: 10px; text-align: left;',
                x_align: Clutter.ActorAlign.FILL,
                x_expand: true
            })
            label.clutter_text.set_line_wrap(true)
            label.clutter_text.set_line_wrap_mode(Pango.WrapMode.WORD)
            box.add_child(label)
            dialog.addButton({
                label: 'OK',
                isDefault: true,
                action: () => {
                    dialog.destroy()
                    Main.uiGroup.remove_child(widget)
                },
            })
            center_actor(widget)
        }

        // create the fuzzy list and bind it to the global stage
        this.vkbd = Clutter.get_default_backend()?.get_default_seat()
            ?.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE)
        const settings = this.getSettings()
        this.menu = new FuzzyPicklist({
            hint: hint,
            rows: settings.get_uint('rows') || 15,
            width: settings.get_uint('width') || 400,
            font_size: settings.get_uint('font-size') || 14,
            scrollbarw: 6,
            onselect: (txt, mods) => {
                this.menu.hide()
                const symbol = txt.split('\t')[0]
                const clipboard = St.Clipboard.get_default()
                clipboard.get_text(St.ClipboardType.CLIPBOARD, (__, last) => {
                    //log(`[symbols] clipboard last value: ${last}, new value: ${symbol}, modifiers: ${mods}`)
                    if (!this.vkbd) return
                    if (last !== symbol)
                        clipboard.set_text(St.ClipboardType.CLIPBOARD, symbol)
                    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => this.vkbd.notify_keyval(Clutter.get_current_event_time(), Clutter.KEY_Control_L, Clutter.KeyState.PRESSED) || GLib.SOURCE_REMOVE)
                    if (mods.has('shift')) 
                        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => this.vkbd.notify_keyval(Clutter.get_current_event_time(), Clutter.KEY_Shift_L, Clutter.KeyState.PRESSED) || GLib.SOURCE_REMOVE)
                    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => this.vkbd.notify_keyval(Clutter.get_current_event_time(), Clutter.KEY_v, Clutter.KeyState.PRESSED) || GLib.SOURCE_REMOVE)
                    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => this.vkbd.notify_keyval(Clutter.get_current_event_time(), Clutter.KEY_v, Clutter.KeyState.RELEASED) || GLib.SOURCE_REMOVE)
                    if (mods.has('shift'))
                        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => this.vkbd.notify_keyval(Clutter.get_current_event_time(), Clutter.KEY_Shift_L, Clutter.KeyState.RELEASED) || GLib.SOURCE_REMOVE)
                    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => this.vkbd.notify_keyval(Clutter.get_current_event_time(), Clutter.KEY_Control_L, Clutter.KeyState.RELEASED) || GLib.SOURCE_REMOVE)
                    if (last && last !== symbol)
                        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 400, () => clipboard.set_text(St.ClipboardType.CLIPBOARD, last) || GLib.SOURCE_REMOVE)
                })
            }
        })
        Main.wm.addKeybinding(
            'shortcut',
            settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.ALL,
            () => this.menu.show(this.items)
        )
   }

    disable() {
        //log('[symbols] disabling extension')
        this.menu.hide()
        Main.wm.removeKeybinding('shortcut')
    }
}
