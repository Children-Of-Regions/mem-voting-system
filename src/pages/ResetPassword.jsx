import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { updatePassword } from '../utils/auth'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function ResetPassword() {
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [validToken, setValidToken] = useState(false)
    const [checking, setChecking] = useState(true)
    const navigate = useNavigate()

    useEffect(() => {
        // Check if user has a valid session from the reset link
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                setValidToken(true)
            }
            setChecking(false)
        })
    }, [])

    async function handleSubmit(e) {
        e.preventDefault()

        if (!password || !confirmPassword) {
            toast.error('Լրացրեք բոլոր դաշտերը')
            return
        }

        if (password.length < 6) {
            toast.error('Գաղտնաբառը պետք է լինի առնվազն 6 նիշ')
            return
        }

        if (password !== confirmPassword) {
            toast.error('Գաղտնաբառերը չեն համընկնում')
            return
        }

        setLoading(true)

        const result = await updatePassword(password)

        if (result.success) {
            toast.success('Գաղտնաբառը փոխված է')
            setTimeout(() => {
                navigate('/admin/dashboard')
            }, 1000)
        } else {
            toast.error(result.error)
        }

        setLoading(false)
    }

    if (checking) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
                <div className="text-center">
                    <span className="spinner"></span>
                    <p className="text-gray-600 mt-4">Ստուգում...</p>
                </div>
            </div>
        )
    }

    if (!validToken) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
                <div className="max-w-md w-full fade-in">
                    <div className="card text-center">
                        <div className="text-6xl mb-4">⚠️</div>
                        <h2 className="text-2xl font-semibold text-text-dark mb-4">
                            Անվավեր հղում
                        </h2>
                        <p className="text-gray-600 mb-6">
                            Այս հղումը անվավեր է կամ ժամկետանց։ Խնդրում ենք նորից հարցում ուղարկել։
                        </p>
                        <button
                            onClick={() => navigate('/admin/forgot-password')}
                            className="btn btn-primary w-full"
                        >
                            Վերականգնել գաղտնաբառը
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
                    <h1 className="text-4xl text-primary mb-2 font-semibold">
                        Նոր գաղտնաբառ
                    </h1>
                    <p className="text-gray-600">
                        Մուտքագրեք ձեր նոր գաղտնաբառը
                    </p>
                </div>

                <div className="card">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Նոր գաղտնաբառ
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input-field"
                                placeholder="Առնվազն 6 նիշ"
                                disabled={loading}
                                autoComplete="new-password"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Հաստատել գաղտնաբառը
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="input-field"
                                placeholder="Կրկնեք գաղտնաբառը"
                                disabled={loading}
                                autoComplete="new-password"
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
                                    Պահպանում...
                                </span>
                            ) : (
                                'Փոխել գաղտնաբառը'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
