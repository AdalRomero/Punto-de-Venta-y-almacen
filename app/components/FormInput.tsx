import type { ReactNode, WheelEvent, KeyboardEvent } from 'react';

interface FormInputProps {
    label?: string;
    required?: boolean;
    placeholder?: string;
    value?: string;
    onChange?: (value: string) => void;
    /** Acepta cualquier <input type>, además de 'textarea' para renderizar un <textarea>. */
    type?: string;
    readOnly?: boolean;
    id?: string;
    autoComplete?: string;
    className?: string;
    iconLeft?: ReactNode;
    iconRight?: ReactNode;
    wrapperClassName?: string;
    autoFocus?: boolean;
    name?: string;
    /** Solo aplican a inputs numéricos. */
    min?: string | number;
    max?: string | number;
    step?: string | number;
    /** Solo aplica cuando type="textarea". */
    rows?: number;
    onWheel?: (e: WheelEvent<HTMLInputElement>) => void;
    onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
    onFocus?: () => void;
}

export default function FormInput({
    label,
    required = false,
    placeholder = '',
    value = '',
    onChange,
    type = 'text',
    readOnly = false,
    id,
    autoComplete,
    className = 'form-input',
    iconLeft,
    iconRight,
    wrapperClassName = '',
    autoFocus = false,
    name,
    min,
    max,
    step,
    rows,
    onWheel,
    onKeyDown,
    onFocus,
}: FormInputProps) {
    const isTextarea = type === 'textarea';
    const fieldClassName = `${className}${readOnly ? ' readonly' : ''}`;

    const field = isTextarea ? (
        <textarea
            id={id}
            name={name}
            className={fieldClassName}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            readOnly={readOnly}
            autoFocus={autoFocus}
            rows={rows}
            onFocus={onFocus}
        />
    ) : (
        <input
            id={id}
            name={name}
            type={type}
            className={fieldClassName}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            readOnly={readOnly}
            autoComplete={autoComplete}
            autoFocus={autoFocus}
            min={min}
            max={max}
            step={step}
            onWheel={onWheel}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
        />
    );

    const hasWrapper = Boolean(iconLeft || iconRight || wrapperClassName);

    const fieldWithWrapper = hasWrapper ? (
        <div
            className={wrapperClassName ? wrapperClassName : undefined}
            style={!wrapperClassName ? { position: 'relative' } : undefined}
        >
            {iconLeft}
            {field}
            {iconRight}
        </div>
    ) : field;

    if (!label) return fieldWithWrapper;

    return (
        <div className="form-group">
            <label className="form-label" htmlFor={id}>
                {label}
                {required && <span className="required">*</span>}
            </label>
            {fieldWithWrapper}
        </div>
    );
}