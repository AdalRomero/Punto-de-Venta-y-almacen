import type { ReactNode } from 'react';

interface FormSelectProps {
    label?: string;
    required?: boolean;
    value?: string;
    onChange?: (value: string) => void;
    options: { value: string; label: string }[];
    /**
     * Texto del placeholder. Se ignora si `options` ya incluye una entrada
     * con value="" (ej. "Sin margen"): en ese caso esa opción ES la
     * selección vacía real, debe quedar siempre seleccionable en la lista
     * y no debe ocultarse detrás de un placeholder deshabilitado.
     */
    placeholder?: string;
    id?: string;
    className?: string;
    iconRight?: ReactNode;
    wrapperClassName?: string;
}

export default function FormSelect({
    label,
    required = false,
    value = '',
    onChange,
    options,
    placeholder = 'Seleccione...',
    id,
    className = 'form-select',
    iconRight,
    wrapperClassName = '',
}: FormSelectProps) {
    // Si las opciones ya traen una entrada value="" (ej. "Sin margen",
    // "Sin impuesto"), esa es la opción vacía real y debe permanecer
    // seleccionable siempre. Si no, agregamos un placeholder deshabilitado
    // y oculto que solo sirve como texto guía inicial.
    const hasEmptyOption = options.some((opt) => opt.value === '');

    const select = (
        <select
            id={id}
            className={className}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
        >
            {!hasEmptyOption && (
                <option value="" disabled hidden>{placeholder}</option>
            )}
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                    {opt.label}
                </option>
            ))}
        </select>
    );

    const hasWrapper = Boolean(iconRight || wrapperClassName);

    const selectWithWrapper = hasWrapper ? (
        <div
            className={wrapperClassName ? wrapperClassName : undefined}
            style={!wrapperClassName ? { position: 'relative' } : undefined}
        >
            {select}
            {iconRight}
        </div>
    ) : select;

    if (!label) return selectWithWrapper;

    return (
        <div className="form-group">
            <label className="form-label" htmlFor={id}>
                {label}
                {required && <span className="required">*</span>}
            </label>
            {selectWithWrapper}
        </div>
    );
}