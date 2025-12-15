using System;
using System.Drawing;
using System.IO;
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
                Icon = LoadBrandedIcon(),
                ContextMenuStrip = BuildMenu()
            };
        }

        /// <summary>
        /// Try to load the branded swoop.ico from known locations, fallback to system icon
        /// </summary>
        private static Icon LoadBrandedIcon()
        {
            try
            {
                // Try common locations for the branded icon
                var exeDir = Path.GetDirectoryName(typeof(Tray).Assembly.Location) ?? "";
                var possiblePaths = new[]
                {
                    Path.Combine(exeDir, "swoop.ico"),
                    Path.Combine(exeDir, "branding", "swoop.ico"),
                    Path.Combine(exeDir, "..", "branding", "swoop.ico"),
                };

                foreach (var path in possiblePaths)
                {
                    if (File.Exists(path))
                    {
                        return new Icon(path);
                    }
                }
            }
            catch (Exception ex)
            {
                Logger.Error("Failed to load branded icon", ex);
            }

            return SystemIcons.Application;
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
