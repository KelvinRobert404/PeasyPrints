import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { PrintSettings, ShopPricing } from '@/types/models';
import { PDFDocument } from 'pdf-lib';
import { calculateTotalCost } from '@/lib/utils/pricing';

interface UploadState {
  file: File | null;
  fileUrl: string | null;
  pageCount: number;
  pageRotations: number[]; // degrees per page (0/90/180/270)
  settings: PrintSettings;
  shopPricing?: ShopPricing;
  totalCost: number;
  loading: boolean;
  error: string | null;

  setShopPricing: (pricing?: ShopPricing) => void;
  setSettings: (partial: Partial<PrintSettings>) => void;
  setFile: (file: File | null) => Promise<void>;
  rotatePage: (index: number, delta: 90 | -90) => void;
  recalc: () => void;
  reset: () => void;
}

const defaultSettings: PrintSettings = {
  paperSize: 'A4',
  printFormat: 'Single-Sided',
  printColor: 'Black & White',
  orientation: 'Vertical',
  binding: '',
  copies: 1,
  extraColorPages: 0,
};

export const useUploadStore = create<UploadState>()(
  immer((set, get) => ({
    file: null,
    fileUrl: null,
    pageCount: 0,
    pageRotations: [],
    settings: defaultSettings,
    shopPricing: undefined,
    totalCost: 0,
    loading: false,
    error: null,

    setShopPricing: (pricing) => {
      set((s) => { s.shopPricing = pricing; });
      get().recalc();
    },

    setSettings: (partial) => {
      set((s) => { s.settings = { ...s.settings, ...partial }; });
      get().recalc();
    },

    setFile: async (file) => {
      if (!file) {
        set((s) => { s.file = null; s.fileUrl = null; s.pageCount = 0; s.pageRotations = []; });
        get().recalc();
        return;
      }
      set((s) => { s.loading = true; s.error = null; });
      try {
        const buf = await file.arrayBuffer();
        const pdf = await PDFDocument.load(buf);
        const pages = pdf.getPageCount();
        const url = URL.createObjectURL(file);
        set((s) => {
          s.file = file;
          s.fileUrl = url;
          s.pageCount = pages;
          s.pageRotations = Array.from({ length: pages }, () => 0);
          s.loading = false;
        });
        get().recalc();
      } catch (e: any) {
        set((s) => { s.loading = false; s.error = e?.message || 'Failed to read PDF'; });
      }
    },

    rotatePage: (index, delta) => {
      set((s) => {
        if (index >= 0 && index < s.pageRotations.length) {
          s.pageRotations[index] = (s.pageRotations[index] + delta + 360) % 360;
        }
      });
    },

    recalc: () => {
      const { settings, pageCount, shopPricing } = get();
      const { total } = calculateTotalCost(settings, pageCount, shopPricing);
      set((s) => { s.totalCost = total; });
    },

    reset: () => {
      set(() => ({
        file: null,
        fileUrl: null,
        pageCount: 0,
        pageRotations: [],
        settings: defaultSettings,
        shopPricing: undefined,
        totalCost: 0,
        loading: false,
        error: null,
      }));
    }
  }))
);
