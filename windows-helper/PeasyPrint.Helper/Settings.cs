using System;
using System.Collections.Generic;

namespace PeasyPrint.Helper
{
    internal sealed class Settings
    {
        public string? PreferredPrinterNameSubstring { get; set; }
        public List<string> AllowedDomains { get; set; } = new List<string>();
        public string? ApiBaseOverride { get; set; }
    }
}


