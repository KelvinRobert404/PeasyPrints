import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface PricingState {
  A4SingBlaWh: number;
  A4SingColor: number;
  A4DoubBlaWh: number;
  A4DoubColor: number;
  A3SingBlaWh: number;
  A3SingColor: number;
  A3DoubBlaWh: number;
  A3DoubColor: number;
  SoftBinding: number;
  HardBinding: number;
  EmergencyPr: number;
  Commision: number;
  finalFile: File | null;
  updateValues: (partial: Partial<PricingState>) => void;
  setFinalFile: (file: File | null) => void;
}

export const usePricingStore = create<PricingState>()(
  immer((set) => ({
    A4SingBlaWh: 2,
    A4SingColor: 5,
    A4DoubBlaWh: 3,
    A4DoubColor: 6,
    A3SingBlaWh: 4,
    A3SingColor: 8,
    A3DoubBlaWh: 5,
    A3DoubColor: 10,
    SoftBinding: 20,
    HardBinding: 30,
    EmergencyPr: 15,
    Commision: 0,
    finalFile: null,
    updateValues: (partial) => set((s) => Object.assign(s, partial)),
    setFinalFile: (file) => set((s) => { s.finalFile = file; })
  }))
);
