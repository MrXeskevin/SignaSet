import { CheckCircle, AlertCircle, Info } from 'lucide-react'

const icons = {
    success: <CheckCircle size={18} />,
    error: <AlertCircle size={18} />,
    info: <Info size={18} />,
}

export default function Toast({ toasts }) {
    if (!toasts.length) return null

    return (
        <div className="toast-container">
            {toasts.map(toast => (
                <div key={toast.id} className={`toast ${toast.type}`}>
                    {icons[toast.type] || icons.info}
                    {toast.message}
                </div>
            ))}
        </div>
    )
}
