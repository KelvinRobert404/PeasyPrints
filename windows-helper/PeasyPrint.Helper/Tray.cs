using System;
using System.Drawing;
using System.Windows.Forms;

namespace PeasyPrint.Helper
{
    internal sealed class Tray : IDisposable
    {
        private readonly NotifyIcon icon;

        public Tray()
        {
            icon = new NotifyIcon
            {
                Text = "PeasyPrint Helper",
                Visible = true,
                Icon = SystemIcons.Application,
                ContextMenuStrip = BuildMenu()
            };
        }

        private ContextMenuStrip BuildMenu()
        {
            var menu = new ContextMenuStrip();
            var settingsItem = new ToolStripMenuItem("Settings", null, (_, __) =>
            {
                var settings = SettingsStore.Load();
                var win = new SettingsWindow(settings);
                win.ShowDialog();
            });
            var exitItem = new ToolStripMenuItem("Exit", null, (_, __) => Application.Exit());
            menu.Items.Add(settingsItem);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(exitItem);
            return menu;
        }

        public void Dispose()
        {
            icon.Visible = false;
            icon.Dispose();
        }
    }
}



