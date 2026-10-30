import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { PlotInput } from "@/lib/engine/types";

export const SAMPLE_PROJECT: PlotInput = {
  length: 40,
  width: 30,
  unit: "ft",
  facing: "E",
  city: "bhopal",
  buildingType: "residential",
  bedrooms: 3,
  poojaRoom: true,
  parking: true,
  elderlyGroundFloor: false,
};

export const DEFAULT_PROJECT: PlotInput = {
  length: 0,
  width: 0,
  unit: "ft",
  facing: "E",
  city: "",
  buildingType: "residential",
  bedrooms: 3,
  poojaRoom: false,
  parking: false,
  elderlyGroundFloor: false,
};

interface WizardState {
  /** Plot/site inputs entered by the user. */
  input: PlotInput;
  /** Wizard step index (0 Inputs, 1 Rules, 2 Design, 3 Sheets). */
  step: number;
  /** true once localStorage rehydration finished. */
  hydrated: boolean;
  patchInput: (patch: Partial<PlotInput>) => void;
  loadSampleProject: () => void;
  resetProject: () => void;
  goToStep: (step: number) => void;
  markHydrated: () => void;
}

const STORAGE_KEY = "vastushilpa-project-v1";
export const STEP_COUNT = 4;

function clampStep(step: unknown): number {
  if (typeof step === "number" && Number.isInteger(step) && step >= 0 && step < STEP_COUNT) {
    return step;
  }
  return 0;
}

export const useWizardStore = create<WizardState>()(
  persist(
    (set) => ({
      input: DEFAULT_PROJECT,
      step: 0,
      hydrated: false,
      patchInput: (patch) =>
        set((state) => ({ input: { ...state.input, ...patch } })),
      loadSampleProject: () => set({ input: { ...SAMPLE_PROJECT } }),
      resetProject: () => set({ input: { ...DEFAULT_PROJECT }, step: 0 }),
      goToStep: (step) => set({ step: clampStep(step) }),
      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({ input: state.input, step: state.step }),
      merge: (persisted, current) => {
        const stored = persisted as Partial<Pick<WizardState, "input" | "step">> | undefined;
        const storedInput = stored?.input;
        return {
          ...current,
          input:
            storedInput && typeof storedInput === "object"
              ? { ...current.input, ...storedInput }
              : current.input,
          step: clampStep(stored?.step),
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);
