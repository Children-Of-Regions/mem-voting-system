import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginAdmin } from '../utils/auth'
import toast, { Toaster } from 'react-hot-toast'

export default function AdminLogin() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()

    async function handleLogin(e) {
        e.preventDefault()

        if (!email || !password) {
            toast.error('Լրացրեք բոլոր դաշտերը')
            return
        }

        setLoading(true)

        const result = await loginAdmin(email, password)

        if (result.success) {
            // Set flag to show welcome message on dashboard
            sessionStorage.setItem('justLoggedIn', 'true')
            // Navigate to dashboard
            navigate('/admin/dashboard')
        } else {
            toast.error(result.error)
        }

        setLoading(false)
    }

    return (
        <div className="min-h-screen bg-fade-50 flex items-center justify-center px-4">
            <Toaster position="top-center" />
            <div className="max-w-md w-full fade-in">
                <div className="text-center mb-8">
                    <h1 className="text-5xl text-brand-500 mb-2 font-bold">
                        Ադմինիստրատոր
                    </h1>
                    <p className="text-fade-600">Մուտք գործեք համակարգ</p>
                </div>

                <div className="card">
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-fade-700 mb-2">
                                Էլ․ փոստ
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="input-field"
                                placeholder="admin@mem.team"
                                disabled={loading}
                                autoComplete="email"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-fade-700 mb-2">
                                Գաղտնաբառ
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input-field"
                                placeholder="••••••••"
                                disabled={loading}
                                autoComplete="current-password"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn btn-primary w-full"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="spinner"></span>
                                    Մուտք...
                                </span>
                            ) : (
                                'Մուտք գործել'
                            )}
                        </button>
                    </form>

                    <div className="text-center mt-4">
                        <a
                            href="/admin/forgot-password"
                            className="text-sm text-brand-500 hover:text-brand-600"
                        >
                            Մոռացե՞լ եք գաղտնաբառը
                        </a>
                    </div>
                </div>

                <div className="text-center mt-6">
                    <a href="/" className="text-brand-500 hover:text-brand-600 text-sm">
                        ← Վերադառնալ գլխավոր էջ
                    </a>
                </div>
            </div>
        </div>
    )
}

