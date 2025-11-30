import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { logoutAdmin } from '../utils/auth'
import { supabase } from '../lib/supabase'
import SinglePageAdmin from '../components/admin/SinglePageAdmin'
import toast, { Toaster } from 'react-hot-toast'

export default function AdminDashboard() {
    const [user, setUser] = useState(null)
    const navigate = useNavigate()

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user)

            // Show welcome message only if this is a fresh login
            // Check if we have the "justLoggedIn" flag in sessionStorage
            if (session?.user && sessionStorage.getItem('justLoggedIn') === 'true') {
                toast.success('Բարի գալուստ')
                // Remove the flag so it doesn't show again on reload
                sessionStorage.removeItem('justLoggedIn')
            }
        })
    }, [])

    async function handleLogout() {
        await logoutAdmin()
        toast.success('Դուք դուրս եկաք համակարգից')
        setTimeout(() => {
            navigate('/admin')
        }, 500)
    }

    return (
        <div className="admin-layout">
            <Toaster position="top-center" />

            {/* Header */}
            <div className="bg-white shadow-sm border-b">
                <div className="container-custom py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-semibold">
                                ՄԵՄ ադմին պանել
                            </h1>
                            <p className="text-sm text-gray-600">{user?.email}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="btn btn-outline"
                        >
                            Դուրս գալ
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="container-custom py-8">
                <SinglePageAdmin />
            </div>
        </div>
    )
}
