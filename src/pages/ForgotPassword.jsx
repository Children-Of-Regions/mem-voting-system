import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { requestPasswordReset } from '../utils/auth'
import toast from 'react-hot-toast'

export default function ForgotPassword() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [emailSent, setEmailSent] = useState(false)
    const navigate = useNavigate()

    async function handleSubmit(e) {
        e.preventDefault()

        if (!email) {
            toast.error('Մուտքագրեք էլ․ փոստը')
            return
        }

        setLoading(true)

        const result = await requestPasswordReset(email)

        if (result.success) {
            setEmailSent(true)
            toast.success('Ստուգեք ձեր էլ․ փոստը')
        } else {
            toast.error(result.error)
        }

        setLoading(false)
    }

    if (emailSent) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
                <div className="max-w-md w-full fade-in">
                    <div className="card text-center">
                        <div className="text-6xl mb-4">📧</div>
                        <h2 className="text-2xl font-semibold text-text-dark mb-4">
                            Ստուգեք ձեր էլ․ փոստը
                        </h2>
                        <p className="text-gray-600 mb-6">
                            Մենք ուղարկել ենք գաղտնաբառի վերականգնման հղում <strong>{email}</strong> հասցեին։
                        </p>
                        <p className="text-sm text-gray-500 mb-6">
                            Եթե նամակը չեք տեսնում, ստուգեք spam թղթապանակը։
                        </p>
                        <button
                            onClick={() => navigate('/admin')}
                            className="btn btn-outline w-full"
                        >
                            Վերադառնալ մուտք
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="max-w-md w-full fade-in">
                <div className="text-center mb-8">
                    <h1 className="text-4xl text-brand-500 mb-2 font-semibold">
                        Մոռացե՞լ եք գաղտնաբառը
                    </h1>
                    <p className="text-gray-600">
                        Մուտքագրեք ձեր էլ․ փոստը և մենք կուղարկենք վերականգնման հղում
                    </p>
                </div>

                <div className="card">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
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

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn btn-primary w-full"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="spinner"></span>
                                    Ուղարկում...
                                </span>
                            ) : (
                                'Ուղարկել վերականգնման հղում'
                            )}
                        </button>
                    </form>
                </div>

                <div className="text-center mt-6">
                    <button
                        onClick={() => navigate('/admin')}
                        className="text-brand-500 hover:text-brand-600 text-sm"
                    >
                        ← Վերադառնալ մուտք
                    </button>
                </div>
            </div>
        </div>
    )
}
