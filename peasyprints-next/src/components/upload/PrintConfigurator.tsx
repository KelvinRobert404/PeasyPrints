'use client';

import { useUploadStore } from '@/lib/stores/uploadStore';
import { cn } from '@/lib/utils/cn';

export function PrintConfigurator() {
  const { settings, setSettings, pageCount } = useUploadStore();

  const toggle = (key: keyof typeof settings, value: any) => () => setSettings({ [key]: value } as any);

  return (
    <div className="space-y-4">
      {/* Paper Size */}
      <div className="grid grid-cols-2 gap-3">
        {(['A3', 'A4'] as const).map((size) => (
          <button
            key={size}
            className={cn(
              'h-16 rounded-2xl border text-xl font-extrabold font-quinn',
              settings.paperSize === size ? 'bg-blue-600 text-white' : 'bg-white text-gray-900'
            )}
            onClick={toggle('paperSize', size)}
          >
            {size}
          </button>
        ))}
      </div>

      {/* Color */}
      <div className="grid grid-cols-2 gap-3">
        {(['Black & White', 'Color'] as const).map((color) => (
          <button
            key={color}
            className={cn(
              'h-12 rounded-xl border text-xs font-semibold',
              settings.printColor === color ? 'bg-blue-600 text-white' : 'bg-white text-gray-900'
            )}
            onClick={toggle('printColor', color)}
          >
            {color === 'Black & White' ? 'black & white' : 'colour'}
          </button>
        ))}
      </div>

      {/* Copies */}
      <div className="grid grid-cols-3 gap-3 items-center">
        <button
          className="h-12 rounded-xl border bg-white text-xl"
          onClick={() => setSettings({ copies: Math.max(1, settings.copies - 1) })}
        >
          -
        </button>
        <div className="h-12 rounded-xl bg-blue-600 text-white flex flex-col items-center justify-center">
          <div className="text-base font-bold">{settings.copies}</div>
          <div className="text-[10px] leading-none">copies</div>
        </div>
        <button
          className="h-12 rounded-xl border bg-white text-xl"
          onClick={() => setSettings({ copies: settings.copies + 1 })}
        >
          +
        </button>
      </div>

      {/* Binding & Sides */}
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
        <select
          className="border rounded h-12 px-3"
          value={settings.printFormat}
          onChange={(e) => setSettings({ printFormat: e.target.value as any })}
        >
          <option>Single-Sided</option>
          <option>Double-Sided</option>
        </select>
      </div>

      {/* No extra color pages input per new design */}

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
