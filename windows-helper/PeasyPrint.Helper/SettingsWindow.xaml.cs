using System;
using System.Collections.Generic;
using System.Linq;
using System.Printing;
using System.Windows;

namespace PeasyPrint.Helper
{
    public partial class SettingsWindow : Window
    {
        private Settings settings;
        private List<string>? _cachedPrinters;

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
                _cachedPrinters = server.GetPrintQueues().Select(q => q.FullName).OrderBy(n => n).ToList();
                BwCombo.ItemsSource = _cachedPrinters;
                ColorCombo.ItemsSource = _cachedPrinters;
            }
            catch (Exception ex)
            {
                Logger.Error("Failed to load printers", ex);
                _cachedPrinters = new List<string>();
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
            ApiBaseText.Text = settings.ApiBaseOverride ?? string.Empty;
        }

        /// <summary>
        /// Find printer matching substring from cached list (no extra query)
        /// </summary>
        private string? FindFirstPrinterContaining(string substring)
        {
            if (_cachedPrinters == null || _cachedPrinters.Count == 0)
            {
                return null;
            }
            
            return _cachedPrinters.FirstOrDefault(
                p => p.IndexOf(substring, StringComparison.OrdinalIgnoreCase) >= 0);
        }

        /// <summary>
        /// Check if a printer name exists in the cached list
        /// </summary>
        private bool IsPrinterValid(string? printerName)
        {
            if (string.IsNullOrWhiteSpace(printerName))
            {
                return true; // Empty is valid (no preference)
            }
            
            return _cachedPrinters?.Any(p => 
                string.Equals(p, printerName, StringComparison.OrdinalIgnoreCase)) == true;
        }

        private void OnSave(object sender, RoutedEventArgs e)
        {
            // Validate printer selections
            var bwPrinter = BwCombo.Text?.Trim();
            var colorPrinter = ColorCombo.Text?.Trim();
            
            if (!string.IsNullOrWhiteSpace(bwPrinter) && !IsPrinterValid(bwPrinter))
            {
                var result = System.Windows.MessageBox.Show(
                    $"Printer '{bwPrinter}' was not found on this system. Save anyway?",
                    "PeasyPrint",
                    MessageBoxButton.YesNo,
                    MessageBoxImage.Warning);
                if (result != MessageBoxResult.Yes) return;
            }
            
            if (!string.IsNullOrWhiteSpace(colorPrinter) && !IsPrinterValid(colorPrinter))
            {
                var result = System.Windows.MessageBox.Show(
                    $"Printer '{colorPrinter}' was not found on this system. Save anyway?",
                    "PeasyPrint",
                    MessageBoxButton.YesNo,
                    MessageBoxImage.Warning);
                if (result != MessageBoxResult.Yes) return;
            }

            settings.BwPrinterNameSubstring = bwPrinter;
            settings.ColorPrinterNameSubstring = colorPrinter;
            settings.PreferredPrinterNameSubstring = FallbackText.Text?.Trim();
            
            // Save API base override (empty string becomes null)
            var apiBase = ApiBaseText.Text?.Trim();
            settings.ApiBaseOverride = string.IsNullOrWhiteSpace(apiBase) ? null : apiBase;
            
            SettingsStore.Save(settings);
            Logger.Info("Settings saved");
            System.Windows.MessageBox.Show("Saved", "PeasyPrint", MessageBoxButton.OK, MessageBoxImage.Information);
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
                Logger.Error("Test printer failed", ex);
                System.Windows.MessageBox.Show(ex.Message, "PeasyPrint", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }
    }
}
