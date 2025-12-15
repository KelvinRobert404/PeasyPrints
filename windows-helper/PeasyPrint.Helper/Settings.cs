using System;

namespace PeasyPrint.Helper
{
    public sealed class Settings
    {
        public string? PreferredPrinterNameSubstring { get; set; }
        public string? BwPrinterNameSubstring { get; set; }
        public string? ColorPrinterNameSubstring { get; set; }
        public string? ApiBaseOverride { get; set; }
    }
}


