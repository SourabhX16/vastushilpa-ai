# Engine

`lib/engine` owns the pure TypeScript planning and evaluation boundary between project inputs and rendered or exported results. It should remain independent of UI code: engine modules must not import components or browser presentation code, so the same calculations can serve the interface and other consumers.

Core modules define the plot coordinate model, Ayadi evaluation, Vastu grid and scoring, and constrained layout generation. `energy/` owns daylight, ventilation, heat, and related energy screening calculations; `structural/` owns member generation, load estimates, and preliminary checks. These subfolders can depend on engine types and shared project data, while presentation stays outside the engine.

Rules, coefficients, and source notes belong in `/lib/data`, alongside their source and `verified` fields. Preserve that provenance at the data boundary: a calculation should not imply that an unverified rule or assumption has been independently validated.
