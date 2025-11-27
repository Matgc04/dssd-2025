import * as yup from "yup";
import { MAX_STAGES, MAX_REQUESTS_PER_STAGE } from "../constants";

/**
 * Internal enum values (stable for API) + human labels (UI)
 */
export const REQUEST_OPTIONS = [
  { value: "economic",  label: "Monetario" },
  { value: "materials", label: "Materiales" },
  { value: "labor",     label: "Mano de obra" },
  { value: "other",     label: "Otro" },
];
export const REQUEST_VALUES = REQUEST_OPTIONS.map(o => o.value);

const DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

const getTodayKey = () => {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return Number(`${now.getFullYear()}${mm}${dd}`);
};

const toDateKey = (value) => {
  if (typeof value !== "string") return null;
  const match = value.match(DATE_REGEX);
  if (!match) return null;
  const [, yyyy, mm, dd] = match;
  return Number(`${yyyy}${mm}${dd}`);
};

const dateNotPast = yup
  .string()
  .required("Requerido")
  .test("valid-date", "Fecha inválida", (value) => toDateKey(value) !== null)
  .test("not-in-past", "No puede estar en el pasado", (value) => {
    const key = toDateKey(value);
    return key === null ? true : key >= getTodayKey();
  });

const toNum = () =>
  yup
    .number()
    .transform((v, o) => (o === "" || o === null || o === undefined ? undefined : Number(o)))
    .typeError("Debe ser un número");

const requestSchema = yup.object({
  type: yup.string().oneOf(REQUEST_VALUES, "Tipo inválido").required("Requerido"),
  description: yup
    .string()
    .required("Requerido")
    .min(3, "La descripción del pedido debe tener al menos 3 caracteres")
    .max(300, "La descripción del pedido no puede superar los 300 caracteres"),
  quantity: toNum().required("La cantidad es requerida (numérica)"),
  unit: yup
    .string()
    .strict(true)
    .trim()
    .typeError("La unidad debe ser un texto")
    .required("La unidad es requerida"),
});

const stageSchema = yup.object({
  name: yup
    .string()
    .required("Requerido")
    .min(3, "El nombre de la etapa debe tener al menos 3 caracteres")
    .max(120, "El nombre de la etapa no puede superar los 120 caracteres"),
  description: yup
    .string()
    .optional()
    .max(1000, "La descripción de la etapa no puede superar los 1000 caracteres"),
  startDate: dateNotPast,
  endDate: dateNotPast.test(
    "stage-end-after-start",
    "La fecha de fin de etapa no puede ser anterior al inicio",
    function (value) {
      const endKey = toDateKey(value);
      const startKey = toDateKey(this.parent?.startDate);
      if (endKey === null || startKey === null) return true;
      return endKey >= startKey;
    }
  ),
  requests: yup
    .array()
    .of(requestSchema)
    .min(1, "Agregá al menos 1 pedido en la etapa")
    .max(MAX_REQUESTS_PER_STAGE, `Máximo ${MAX_REQUESTS_PER_STAGE} pedidos por etapa`),
});

export const projectSchema = yup.object({
  project: yup.object({
    name: yup
      .string()
      .required("Requerido")
      .min(3, "El nombre del proyecto debe tener al menos 3 caracteres")
      .max(120, "El nombre del proyecto no puede superar los 120 caracteres"),
    description: yup
      .string()
      .required("Requerido")
      .min(10, "La descripción del proyecto debe tener al menos 10 caracteres")
      .max(2000, "La descripción del proyecto no puede superar los 2000 caracteres"),
    originCountry: yup
      .string()
      .matches(/^[A-Z]{2}$/i, "Código ISO 3166-1 alfa-2 (ej: AR)")
      .required("Requerido"),
    startDate: dateNotPast,
    endDate: dateNotPast.test(
      "project-end-after-start",
      "La fecha de fin no puede ser anterior al inicio",
      function (value) {
        const endKey = toDateKey(value);
        const startKey = toDateKey(this.parent?.startDate);
        if (endKey === null || startKey === null) return true;
        return endKey >= startKey;
      }
    ),
    createdByOrgId: yup.string().required("Requerido"),
    stages: yup
      .array()
      .of(stageSchema)
      .min(1, "Debe haber al menos 1 etapa")
      .max(MAX_STAGES, `Máximo ${MAX_STAGES} etapas`)
      .test(
        "stages-within-project-range",
        "Las etapas deben estar dentro del rango del proyecto",
        function (stages) {
          const projectStart = toDateKey(this.parent?.startDate);
          const projectEnd = toDateKey(this.parent?.endDate);
          if (!Array.isArray(stages) || projectStart === null || projectEnd === null) return true;

          for (let i = 0; i < stages.length; i += 1) {
            const stageStart = toDateKey(stages[i]?.startDate);
            const stageEnd = toDateKey(stages[i]?.endDate);
            if (stageStart !== null && stageStart < projectStart) {
              return this.createError({
                path: `${this.path}[${i}].startDate`,
                message: "La etapa no puede iniciar antes que el proyecto",
              });
            }
            if (stageEnd !== null && stageEnd > projectEnd) {
              return this.createError({
                path: `${this.path}[${i}].endDate`,
                message: "La etapa no puede finalizar después del proyecto",
              });
            }
          }

          return true;
        }
      ),
  }),
});
