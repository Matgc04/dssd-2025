import * as yup from "yup";

const toOptionalNumber = () =>
  yup
    .number()
    .transform((value, original) =>
      original === "" || original === null || original === undefined ? undefined : Number(original)
    )
    .typeError("Debe ser un número")
    .nullable();

export const collaborationRequestSchema = yup
  .object({
    stageId: yup.string().required("Elegí una etapa"),
    requestId: yup.string().required("Elegí un pedido"),
    quantityAvailable: toOptionalNumber(),
    unit: yup.string().nullable(),
    amountAvailable: toOptionalNumber(),
    currency: yup.string().nullable().max(3, "Máximo 3 caracteres"),
    expectedDeliveryDate: yup
      .string()
      .nullable()
      .test("future-date", "La fecha debe ser posterior a hoy", (value) => {
        if (!value) return true;
        const chosen = new Date(value);
        if (Number.isNaN(chosen.getTime())) {
          return false;
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return chosen.getTime() > today.getTime();
      }),
    notes: yup.string().nullable().max(500, "Máximo 500 caracteres"),
  })
  .test(
    "has-quantity-or-amount",
    "Informá al menos cantidad o importe disponible",
    (values) => {
      if (!values) return false;
      const hasQuantity =
        values.quantityAvailable !== null && values.quantityAvailable !== undefined && values.quantityAvailable !== "";
      const hasAmount =
        values.amountAvailable !== null && values.amountAvailable !== undefined && values.amountAvailable !== "";
      return hasQuantity || hasAmount;
    }
  );
