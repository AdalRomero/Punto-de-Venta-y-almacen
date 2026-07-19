import { useState } from 'react';
import FormInput from './FormInput';
import { LockIcon, EyeIcon, EyeOffIcon } from '../components/Icons';

interface PasswordInputProps {
    id?: string;
    name?: string;
    required?: boolean;
    placeholder?: string;
    value?: string;
    onChange?: (value: string) => void;
    className?: string;
    wrapperClassName?: string;
    iconClassName?: string;
    toggleClassName?: string;
    autoFocus?: boolean;
    autoComplete?: string;
}

/* Campo de contraseña reutilizable: junta en un solo componente lo que
   antes se repetía cada vez que se necesitaba una contraseña — el
   FormInput, el icono de candado a la izquierda y el botón de
   mostrar/ocultar (con sus dos íconos) a la derecha. */
export default function PasswordInput({
    id,
    name,
    required = false,
    placeholder,
    value = '',
    onChange,
    className = 'form-input',
    wrapperClassName = 'relative',
    iconClassName = 'login-input-icon',
    toggleClassName = 'absolute inset-y-0 right-0 pr-4 flex items-center text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer',
    autoFocus,
    autoComplete,
}: PasswordInputProps) {
    const [visible, setVisible] = useState(false);

    return (
        <FormInput
            id={id}
            name={name}
            type={visible ? 'text' : 'password'}
            required={required}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            className={className}
            wrapperClassName={wrapperClassName}
            autoFocus={autoFocus}
            autoComplete={autoComplete}
            iconLeft={
                <span className={iconClassName}>
                    <LockIcon />
                </span>
            }
            iconRight={
                <button
                    type="button"
                    onClick={() => setVisible((v) => !v)}
                    className={toggleClassName}
                    aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                    {visible ? <EyeOffIcon /> : <EyeIcon />}
                </button>
            }
        />
    );
}