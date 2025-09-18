export const EXAMPLE_PROJECT = {
  name: "Mejora de centro comunitario",
  description: "Refacción de techos y sanitarios en barrio San Jorge.",
  originCountry: "AR",
  startDate: "2025-10-01",
  endDate: "2026-03-31",
  createdByOrgId: "ong_123",
  stages: [
    {
      name: "Relevamiento",
      description: "Inspección técnica y presupuesto preliminar.",
      startDate: "2025-10-01",
      endDate: "2025-10-15",
      requests: [
        { type: "materials", description: "Cemento Portland", quantity: 200, unit: "bolsas" },
        { type: "labor", description: "Oficiales albañiles", quantity: 3, unit: "personas" },
        { type: "economic", description: "Transporte de materiales", amount: 1500, currency: "USD" },
      ],
    },
    {
      name: "Ejecución de obra",
      description: "Colocación de techo nuevo y reacondicionamiento sanitario.",
      startDate: "2025-11-01",
      endDate: "2026-02-28",
      requests: [
        { type: "materials", description: "Chapas galvanizadas N°25", quantity: 120, unit: "unidades" },
        { type: "economic", description: "Fondo contingencias", amount: 5000, currency: "USD" },
      ],
    },
  ],
};
