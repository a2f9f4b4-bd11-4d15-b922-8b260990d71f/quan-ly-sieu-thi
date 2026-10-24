"use client";

import { useState } from "react";
import { useForm, type FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodType } from "zod";
import { applyServerErrors } from "./applyServerErrors";

export type FieldSpec = {
  name: string;
  label: string;
  type?: "text" | "number" | "select" | "textarea";
  options?: Array<{ value: string | number; label: string }>;
  placeholder?: string;
};

/**
 * A dynamic form shell: the field list and schema are data, so the values are
 * only known at the call site. Typed over FieldValues rather than a generic T —
 * zod's inferred input type and react-hook-form's TFieldValues do not unify,
 * and callers narrow the values themselves.
 */
type Props = {
  title: string;
  fields: FieldSpec[];
  schema: ZodType;
  defaultValues: FieldValues;
  onSubmit: (values: FieldValues) => Promise<unknown>;
  onClose: () => void;
  submitLabel?: string;
};

export function ResourceForm({
  title, fields, schema, defaultValues, onSubmit, onClose, submitLabel = "Lưu",
}: Props) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register, handleSubmit, setError,
    formState: { errors, isSubmitting },
  } = useForm<FieldValues>({
    resolver: zodResolver(schema as never),
    defaultValues,
  });

  async function submit(values: FieldValues) {
    setFormError(null);
    try {
      await onSubmit(values);
      onClose();
    } catch (error) {
      // Field-scoped errors land on their inputs; anything else becomes a banner
      // and the dialog stays open so the entry is not lost.
      const message = applyServerErrors(error, (field, e) =>
        setError(field, { message: e.message }),
      );
      if (message) setFormError(message);
    }
  }

  return (
    <div role="dialog" aria-label={title} className="rounded-lg border bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>

      <form onSubmit={handleSubmit(submit)} className="space-y-3" noValidate>
        {fields.map((field) => {
          const fieldError = errors[field.name];
          return (
            <label key={field.name} className="block space-y-1">
              <span className="text-sm font-medium">{field.label}</span>

              {field.type === "select" ? (
                <select
                  {...register(field.name)}
                  className="w-full rounded-md border px-3 py-2"
                >
                  {field.options?.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : field.type === "textarea" ? (
                <textarea
                  {...register(field.name)}
                  placeholder={field.placeholder}
                  className="w-full rounded-md border px-3 py-2"
                />
              ) : (
                <input
                  {...register(field.name)}
                  type={field.type === "number" ? "number" : "text"}
                  placeholder={field.placeholder}
                  className="w-full rounded-md border px-3 py-2"
                />
              )}

              {fieldError?.message && (
                <span className="block text-sm text-red-600">{String(fieldError.message)}</span>
              )}
            </label>
          );
        })}

        {formError && (
          <p role="alert" data-testid="form-error" className="text-sm text-red-600">
            {formError}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button" onClick={onClose}
            className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            type="submit" disabled={isSubmitting}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isSubmitting ? "Đang lưu…" : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
