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

const toNum = () =>
  yup
    .number()
    .transform((v, o) => (o === "" || o === null || o === undefined ? undefined : Number(o)))
    .typeError("Debe ser un número");

const requestSchema = yup.object({
  type: yup.string().oneOf(REQUEST_VALUES, "Tipo inválido").required("Requerido"),
  description: yup.string().required("Requerido").min(3).max(300),
  amount: toNum().nullable(),     // para economic
  currency: yup.string().nullable(), // ISO-4217 p/ economic
  quantity: toNum().nullable(),   // para materials/labor
  unit: yup.string().nullable(),
});

const stageSchema = yup.object({
  name: yup.string().required("Requerido").min(3).max(120),
  description: yup.string().optional().max(1000),
  startDate: yup.string().required("Requerido"),
  endDate: yup.string().required("Requerido"),
  requests: yup.array().of(requestSchema).max(
    MAX_REQUESTS_PER_STAGE,
    `Máximo ${MAX_REQUESTS_PER_STAGE}`
  ),
});

export const projectSchema = yup.object({
  project: yup.object({
    name: yup.string().required("Requerido").min(3).max(120),
    description: yup.string().required("Requerido").min(10).max(2000),
    originCountry: yup
      .string()
      .matches(/^[A-Z]{2}$/i, "ISO-3166 alpha-2")
      .required("Requerido"),
    startDate: yup.string().required("Requerido"),
    endDate: yup.string().required("Requerido"),
    createdByOrgId: yup.string().required("Requerido"),
    stages: yup
      .array()
      .of(stageSchema)
      .min(1, "Debe haber al menos 1 stage")
      .max(MAX_STAGES, `Máximo ${MAX_STAGES} stages`),
  }),
});
