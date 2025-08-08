'use client';

import { useUploadStore } from '@/lib/stores/uploadStore';

export function PrintConfigurator() {
  const { settings, setSettings, pageCount } = useUploadStore();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <select
          className="border rounded h-12 px-3"
          value={settings.paperSize}
          onChange={(e) => setSettings({ paperSize: e.target.value as any })}
        >
          <option value="A4">A4</option>
          <option value="A3">A3</option>
        </select>
        <select
          className="border rounded h-12 px-3"
          value={settings.printFormat}
          onChange={(e) => setSettings({ printFormat: e.target.value as any })}
        >
          <option>Single-Sided</option>
          <option>Double-Sided</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <select
          className="border rounded h-12 px-3"
          value={settings.printColor}
          onChange={(e) => setSettings({ printColor: e.target.value as any })}
        >
          <option>Black & White</option>
          <option>Color</option>
        </select>
        <select
          className="border rounded h-12 px-3"
          value={settings.orientation}
          onChange={(e) => setSettings({ orientation: e.target.value as any })}
        >
          <option>Vertical</option>
          <option>Horizontal</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <select
          className="border rounded h-12 px-3"
          value={settings.binding}
          onChange={(e) => setSettings({ binding: e.target.value as any })}
        >
          <option value="">No Binding</option>
          <option>Soft Binding</option>
          <option>Spiral Binding</option>
          <option>Hard Binding</option>
        </select>
        <input
          className="border rounded h-12 px-3"
          type="number"
          min={1}
          value={settings.copies}
          onChange={(e) => setSettings({ copies: Math.max(parseInt(e.target.value || '1', 10), 1) })}
        />
      </div>
      {settings.printColor === 'Black & White' && (
        <div className="grid grid-cols-2 gap-3">
          <input
            className="border rounded h-12 px-3"
            type="number"
            min={0}
            placeholder="Color pages"
            value={settings.extraColorPages ?? 0}
            onChange={(e) => setSettings({ extraColorPages: Math.max(parseInt(e.target.value || '0', 10), 0) })}
          />
          <div className="h-12 flex items-center text-xs text-gray-600">of {pageCount} pages</div>
        </div>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={!!settings.emergency}
          onChange={(e) => setSettings({ emergency: e.target.checked })}
        />
        Emergency print
      </label>
    </div>
  );
}
