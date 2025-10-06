using System;
using System.Linq;
using System.Printing;
using System.Windows;

namespace PeasyPrint.Helper
{
    public partial class SettingsWindow : Window
    {
        private Settings settings;

        public SettingsWindow(Settings existing)
        {
            InitializeComponent();
            settings = existing;
            LoadPrinters();
            Prefill();
        }

        private void LoadPrinters()
        {
            try
            {
                var server = new LocalPrintServer();
                var printers = server.GetPrintQueues().Select(q => q.FullName).OrderBy(n => n).ToList();
                BwCombo.ItemsSource = printers;
                ColorCombo.ItemsSource = printers;
            }
            catch
            {
                // ignore
            }
        }

        private void Prefill()
        {
            if (!string.IsNullOrWhiteSpace(settings.BwPrinterNameSubstring))
            {
                BwCombo.Text = FindFirstPrinterContaining(settings.BwPrinterNameSubstring) ?? settings.BwPrinterNameSubstring;
            }
            if (!string.IsNullOrWhiteSpace(settings.ColorPrinterNameSubstring))
            {
                ColorCombo.Text = FindFirstPrinterContaining(settings.ColorPrinterNameSubstring) ?? settings.ColorPrinterNameSubstring;
            }
            FallbackText.Text = settings.PreferredPrinterNameSubstring ?? string.Empty;
        }

        private static string? FindFirstPrinterContaining(string substring)
        {
            try
            {
                var server = new LocalPrintServer();
                foreach (var q in server.GetPrintQueues())
                {
                    if (q.FullName.IndexOf(substring, StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        return q.FullName;
                    }
                }
            }
            catch { }
            return null;
        }

        private void OnSave(object sender, RoutedEventArgs e)
        {
            settings.BwPrinterNameSubstring = BwCombo.Text?.Trim();
            settings.ColorPrinterNameSubstring = ColorCombo.Text?.Trim();
            settings.PreferredPrinterNameSubstring = FallbackText.Text?.Trim();
            SettingsStore.Save(settings);
            MessageBox.Show("Saved", "PeasyPrint", MessageBoxButton.OK, MessageBoxImage.Information);
            Close();
        }

        private void OnTestBw(object sender, RoutedEventArgs e)
        {
            TestPrinter(BwCombo.Text);
        }

        private void OnTestColor(object sender, RoutedEventArgs e)
        {
            TestPrinter(ColorCombo.Text);
        }

        private void TestPrinter(string? device)
        {
            try
            {
                var dlg = new System.Windows.Controls.PrintDialog();
                if (!string.IsNullOrWhiteSpace(device))
                {
                    var server = new LocalPrintServer();
                    var q = server.GetPrintQueues().FirstOrDefault(p => string.Equals(p.FullName, device, StringComparison.OrdinalIgnoreCase));
                    if (q != null) dlg.PrintQueue = q;
                }
                dlg.PrintTicket = new System.Printing.PrintTicket { PageMediaSize = new PageMediaSize(PageMediaSizeName.ISOA4) };
                dlg.ShowDialog();
            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.Message, "PeasyPrint", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }
    }
}


