import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { PrintSettings, ShopPricing, PrintJobType } from '@/types/models';
import { PDFDocument } from 'pdf-lib';
import { calculateTotalCost } from '@/lib/utils/pricing';
import { usePricingStore } from '@/lib/stores/pricingStore';
import { captureEvent } from '@/lib/posthog/client';

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

  // New: umbrella job type and images workflow state
  jobType: PrintJobType;
  images: File[];
  imagesPages: number; // target pages for Images mode (1-5)
  imagesGapCm: number; // spacing between images in cm (0-4)
  imagesScale: number; // 0.5 - 2.0 multiplier for image size

  // Assignment workflow state
  assignmentMode: 'BW' | 'Mixed';
  assignmentColorPages: number[]; // 1-based page indices
  assignmentConfirmed: boolean;

  setShopPricing: (pricing?: ShopPricing) => void;
  setSettings: (partial: Partial<PrintSettings>) => void;
  setFile: (file: File | null) => Promise<void>;
  rotatePage: (index: number, delta: 90 | -90) => void;
  recalc: () => void;
  reset: () => void;

  // New setters for umbrella flow
  setJobType: (jobType: PrintJobType) => void;
  setImages: (files: File[]) => void;
  setImagesPages: (n: number) => void;
  setImagesGapCm: (n: number) => void;
  setImagesScale: (n: number) => void;
  setAssignmentMode: (mode: 'BW' | 'Mixed') => void;
  toggleAssignmentColorPage: (page: number) => void;
  clearAssignmentSelection: () => void;
  setAssignmentConfirmed: (v: boolean) => void;
}

const defaultSettings: PrintSettings = {
  paperSize: 'A4',
  printFormat: 'Single-Sided',
  printColor: 'Black & White',
  orientation: 'Vertical',
  binding: '',
  copies: 1,
  extraColorPages: 0,
  emergency: false,
  afterDark: false,
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
    jobType: 'PDF',
    images: [],
    imagesPages: 1,
    imagesGapCm: 0.5,
    imagesScale: 1.0,
    assignmentMode: 'BW',
    assignmentColorPages: [],
    assignmentConfirmed: false,

    setShopPricing: (pricing) => {
      set((s) => { s.shopPricing = pricing; });
      get().recalc();
    },

    setSettings: (partial) => {
      set((s) => {
        const next = { ...s.settings, ...partial } as PrintSettings;
        // Enforce mutual exclusivity between emergency (rush) and afterDark
        if (partial?.emergency) next.afterDark = false;
        if (partial?.afterDark) next.emergency = false;
        s.settings = next;
      });
      get().recalc();
    },

    setJobType: (jobType) => {
      set((s) => {
        s.jobType = jobType;
        // Reset file/images when switching modes to avoid stale state
        s.file = null;
        s.fileUrl = null;
        s.pageCount = 0;
        s.pageRotations = [];
        s.images = [];
        // Adjust settings for Assignment constraints
        if (jobType === 'Assignment') {
          s.settings.paperSize = 'A4';
          s.settings.printFormat = 'Single-Sided';
          s.settings.copies = Math.max(s.settings.copies || 1, 1);
          s.assignmentMode = 'BW';
          s.assignmentColorPages = [];
          s.assignmentConfirmed = false;
          s.settings.extraColorPages = 0;
        }
        if (jobType !== 'Assignment') {
          s.assignmentConfirmed = false;
          s.assignmentColorPages = [];
        }
      });
      get().recalc();
    },

    setImages: (files) => {
      set((s) => {
        // Combined mode stays on 'PDF' for selector purposes; clear any selected PDF
        if (s.jobType !== 'Assignment') {
          s.jobType = 'PDF';
        }
        s.file = null;
        s.fileUrl = null;
        s.pageRotations = [];
        s.images = files;
        // Recompute page count for Images mode
        const target = Math.min(Math.max(s.imagesPages || 1, 1), 5);
        s.pageCount = target;
      });
      get().recalc();
    },

    setImagesPages: (n) => {
      set((s) => {
        s.imagesPages = Math.min(Math.max(Number(n) || 1, 1), 5);
        s.pageCount = s.jobType === 'Images' ? s.imagesPages : s.pageCount;
      });
      get().recalc();
    },

    setImagesGapCm: (n) => {
      set((s) => {
        s.imagesGapCm = 0.5; // spacing fixed at 0.5cm
      });
    },

    setImagesScale: (n) => {
      set((s) => {
        const v = Math.max(0.5, Math.min(Number(n) || 1.0, 2.0));
        s.imagesScale = v;
      });
    },

    setAssignmentMode: (mode) => {
      set((s) => {
        s.assignmentMode = mode;
        if (mode === 'BW') {
          s.assignmentColorPages = [];
          s.assignmentConfirmed = false;
          s.settings.extraColorPages = 0;
        }
      });
      get().recalc();
    },

    toggleAssignmentColorPage: (page) => {
      set((s) => {
        if (s.assignmentMode !== 'Mixed') return;
        const p = Math.max(1, Math.floor(page));
        const idx = s.assignmentColorPages.indexOf(p);
        if (idx >= 0) s.assignmentColorPages.splice(idx, 1);
        else s.assignmentColorPages.push(p);
        s.assignmentColorPages.sort((a, b) => a - b);
        s.settings.extraColorPages = s.assignmentColorPages.length;
        s.assignmentConfirmed = false;
      });
      get().recalc();
    },

    clearAssignmentSelection: () => {
      set((s) => {
        s.assignmentColorPages = [];
        s.settings.extraColorPages = 0;
        s.assignmentConfirmed = false;
      });
      get().recalc();
    },

    setAssignmentConfirmed: (v) => {
      set((s) => { s.assignmentConfirmed = v; });
    },

    setFile: async (file) => {
      if (!file) {
        set((s) => { s.file = null; s.fileUrl = null; s.pageCount = 0; s.pageRotations = []; });
        get().recalc();
        return;
      }
      set((s) => { s.loading = true; s.error = null; });
      try {
        // Only count pages for PDF/Assignment modes
        const { jobType } = get();
        // Switch to PDF mode unless explicitly in Assignment
        set((s) => {
          if (jobType !== 'Assignment') {
            s.jobType = 'PDF';
          }
          s.images = [];
        });
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
        // Track upload analyzed with masked filename
        captureEvent('upload_analyzed', { totalPages: pages });
      } catch (e: any) {
        set((s) => { s.loading = false; s.error = e?.message || 'Failed to read PDF'; });
        captureEvent('error', { error: e?.message || 'Failed to read PDF' });
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
      const { settings, pageCount, shopPricing, images, imagesPages } = get();
      const hasImages = (images?.length || 0) > 0;
      const effectivePages = hasImages ? Math.min(Math.max(imagesPages || 1, 1), 5) : pageCount;
      const effectivePricing: ShopPricing | undefined = shopPricing ?? (() => {
        // Fallback to legacy defaults from pricingStore if shop pricing not loaded
        try {
          const p = usePricingStore.getState();
          return {
            a4: {
              singleBW: p.A4SingBlaWh,
              doubleBW: p.A4DoubBlaWh,
              singleColor: p.A4SingColor,
              doubleColor: p.A4DoubColor
            },
            a3: {
              singleBW: p.A3SingBlaWh,
              doubleBW: p.A3DoubBlaWh,
              singleColor: p.A3SingColor,
              doubleColor: p.A3DoubColor
            },
            services: {
              softBinding: p.SoftBinding,
              hardBinding: p.HardBinding,
              spiralBinding: 0,
              emergency: p.EmergencyPr,
              afterDark: 0
            }
          } as ShopPricing;
        } catch {
          return undefined;
        }
      })();
      const { total } = calculateTotalCost(settings, effectivePages, effectivePricing);
      set((s) => { s.totalCost = total; });
      captureEvent('pricing_recalculated', { totalPages: effectivePages, totalCost: total, printSettings: settings, jobType: get().jobType });
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
        jobType: 'PDF',
        images: [],
        imagesPages: 1,
        imagesGapCm: 0.5,
        imagesScale: 1.0,
        assignmentMode: 'BW',
        assignmentColorPages: [],
        assignmentConfirmed: false,
      }));
    }
  }))
);
