using System.Windows;

namespace PeasyPrint.Helper
{
    public partial class ProgressWindow : Window
    {
        public ProgressWindow(string message)
        {
            InitializeComponent();
            try { MessageText.Text = message; } catch { }
        }
    }
}


