import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { generateUniqueCodes } from '../../utils/codeGenerator'
import { updatePassword } from '../../utils/auth'
import toast from 'react-hot-toast'
import { api } from '../../services/api'
import { POLLING_INTERVAL, MAX_DESCRIPTION_LENGTH, MAX_DETAILED_INFO_LENGTH, MIN_PASSWORD_LENGTH, MIN_CODE_COUNT, MAX_CODE_COUNT, DEFAULT_ITEMS_PER_PAGE, IMAGE_ASPECT_RATIO, IMAGE_ASPECT_RATIO_TOLERANCE } from '../../constants'
import DropdownMenu from './DropdownMenu'
import Pagination from './Pagination'
import Modal from './Modal'

export default function SinglePageAdmin() {
    // Voting config state
    const [config, setConfig] = useState(null)

    // Nominees state
    const [nominees, setNominees] = useState([])
    const [editingNominee, setEditingNominee] = useState(null)
    const [newNominee, setNewNominee] = useState({ name: '', description: '', detailed_info: '', image_url: '', imageFile: null })
    const [showAddModal, setShowAddModal] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)

    // Codes state
    const [codes, setCodes] = useState([])
    const [codeCount, setCodeCount] = useState(10)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterStatus, setFilterStatus] = useState('all')
    const [showGenerateForm, setShowGenerateForm] = useState(false)
    const [showSearchFilter, setShowSearchFilter] = useState(false)
    const [generating, setGenerating] = useState(false)

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE)

    // Loading states
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)

    // Change password state
    const [showChangePasswordModal, setShowChangePasswordModal] = useState(false)
    const [newPassword, setNewPassword] = useState('')
    const [confirmNewPassword, setConfirmNewPassword] = useState('')
    const [changingPassword, setChangingPassword] = useState(false)

    // Email Manager state
    const [emailFile, setEmailFile] = useState(null)
    const [uploadingEmails, setUploadingEmails] = useState(false)
    const [emailLogs, setEmailLogs] = useState([])
    const [emailStats, setEmailStats] = useState({ sent: 0, failed: 0, pending: 0, total: 0 })
    const [emailProcessing, setEmailProcessing] = useState(false)
    const [editingEmail, setEditingEmail] = useState(null)
    const [showEditEmailModal, setShowEditEmailModal] = useState(false)

    useEffect(() => {
        fetchAllData()

        // Poll codes every 3 seconds (updates both Codes list and Email stats)
        const interval = setInterval(fetchCodes, POLLING_INTERVAL)
        return () => clearInterval(interval)
    }, [])

    // Derive email stats from codes whenever they change
    useEffect(() => {
        if (codes) {
            const stats = codes.reduce((acc, code) => {
                if (code.email) { // Only count if it has an email
                    acc[code.email_status] = (acc[code.email_status] || 0) + 1
                    acc.total++
                }
                return acc
            }, { sent: 0, failed: 0, pending: 0, total: 0 })

            setEmailStats(stats)

            // Filter failed emails for the log view
            const failed = codes.filter(c => c.email_status === 'failed' && c.email)
            setEmailLogs(failed)
        }
    }, [codes])

    async function fetchCodes() {
        const { data: codesData } = await supabase
            .from('voting_codes')
            .select('*, nominees(name)')
            .eq('config_id', 1)
            .order('created_at', { ascending: false })

        if (codesData) {
            setCodes(codesData)
        }
    }

    async function fetchAllData() {
        setLoading(true)

        // Fetch voting config
        const { data: configData } = await supabase
            .from('voting_config')
            .select('*')
            .eq('id', 1)
            .single()

        if (configData) {
            setConfig(configData)

            // Fetch nominees
            const { data: nomineesData } = await supabase
                .from('nominees')
                .select('*')
                .eq('config_id', 1)
                .order('vote_count', { ascending: false })

            setNominees(nomineesData || [])

            // Fetch codes
            await fetchCodes()
        }

        setLoading(false)
    }



    async function handleEmailUpload() {
        if (!emailFile) {
            toast.error('Ընտրեք ֆայլը')
            return
        }

        setUploadingEmails(true)
        setEmailProcessing(true)

        try {
            const text = await emailFile.text()
            // Split by newlines or commas and clean up
            const emails = text.split(/[\n,]/)
                .map(e => e.trim())
                .filter(e => e && e.includes('@'))

            if (emails.length === 0) {
                toast.error('Ֆայլում էլ․ հասցեներ չեն գտնվել')
                setUploadingEmails(false)
                return
            }

            // Validate email format
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
            const validEmails = []
            const invalidEmails = []

            emails.forEach(email => {
                if (emailRegex.test(email)) {
                    validEmails.push(email)
                } else {
                    invalidEmails.push(email)
                }
            })

            // Check which valid emails already exist in database
            const { data: existingCodes } = await supabase
                .from('voting_codes')
                .select('email, code')
                .in('email', validEmails)

            const existingEmails = new Set(existingCodes?.map(c => c.email) || [])
            const newEmails = validEmails.filter(email => !existingEmails.has(email))
            const duplicateEmails = validEmails.filter(email => existingEmails.has(email))

            let insertedCount = 0
            let failedCount = 0

            // 1. Insert new valid emails with status 'pending'
            if (newEmails.length > 0) {
                const codesToInsert = newEmails.map(email => {
                    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
                    let code = ''
                    for (let i = 0; i < 6; i++) {
                        if (i === 3) code += '-'
                        code += chars.charAt(Math.floor(Math.random() * chars.length))
                    }
                    return {
                        email,
                        code,
                        email_status: 'pending',
                        is_used: false,
                        created_at: new Date().toISOString()
                    }
                })

                const { error: insertError } = await supabase
                    .from('voting_codes')
                    .insert(codesToInsert)

                if (insertError) {
                    throw insertError
                }
                insertedCount = newEmails.length
            }

            // 2. Mark duplicate emails as 'failed' so they appear in failed list
            if (duplicateEmails.length > 0) {
                const { error: updateError } = await supabase
                    .from('voting_codes')
                    .update({
                        email_status: 'failed',
                        email_error: 'Էլ․ հասցեն արդեն գոյություն ունի տվյալների բազայում'
                    })
                    .in('email', duplicateEmails)

                if (updateError) {
                    throw updateError
                }
                failedCount += duplicateEmails.length
            }

            // 3. Insert invalid emails with status 'failed'
            if (invalidEmails.length > 0) {
                const invalidCodesToInsert = invalidEmails.map(email => {
                    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
                    let code = ''
                    for (let i = 0; i < 6; i++) {
                        if (i === 3) code += '-'
                        code += chars.charAt(Math.floor(Math.random() * chars.length))
                    }
                    return {
                        email,
                        code,
                        email_status: 'failed',
                        email_error: 'Անվավեր էլ․ հասցեի ֆորմատ',
                        is_used: false,
                        created_at: new Date().toISOString()
                    }
                })

                const { error: invalidInsertError } = await supabase
                    .from('voting_codes')
                    .insert(invalidCodesToInsert)
                    .select()

                if (invalidInsertError) {
                    // If insert fails (e.g., duplicate), just log it
                    console.error('Invalid email insert error:', invalidInsertError)
                }
                failedCount += invalidEmails.length
            }

            const messages = []
            if (insertedCount > 0) messages.push(`${insertedCount} նոր էլ․ հասցե ավելացվեց հերթում`)
            if (failedCount > 0) messages.push(`${failedCount} էլ․ հասցե ավելացվեց ձախողված ցուցակում`)

            toast.success(messages.join(', '))
            setEmailFile(null)
            document.getElementById('email-file-input').value = ''
            await fetchCodes() // Refresh to show failed emails

            // Trigger server worker immediately if there are new emails to send
            if (insertedCount > 0) {
                try {
                    await api.triggerEmailProcess()
                    toast.success('Սերվերը սկսել է էլ․ հասցեների ուղարկումը', {
                        icon: '📧',
                        duration: 3000
                    })
                } catch (error) {
                    console.error('Failed to trigger server:', error)
                    toast.error('Սերվերի հետ կապի խնդիր')
                }
            }

        } catch (error) {
            console.error('Email upload error:', error)
            toast.error('Սխալ: ' + error.message)
        } finally {
            setUploadingEmails(false)
        }
    }




    async function handleImageSelect(file, isEditing = false) {
        // Validate aspect ratio (1:1)
        const isValidRatio = await new Promise((resolve) => {
            const img = new Image()
            img.onload = () => {
                const ratio = img.width / img.height
                // Allow larger tolerance (1.4 - 1.6) to be more forgiving
                const tolerance = IMAGE_ASPECT_RATIO_TOLERANCE
                const targetRatio = IMAGE_ASPECT_RATIO
                resolve(Math.abs(ratio - targetRatio) < tolerance)
            }
            img.onerror = () => resolve(false)
            img.src = URL.createObjectURL(file)
        })

        if (!isValidRatio) {
            toast.error('Նկարի հարաբերակցությունը պետք է լինի 1:1 (քառակուսի)')
            return
        }

        // Create local preview URL
        const previewUrl = URL.createObjectURL(file)

        if (isEditing) {
            setEditingNominee(prev => ({ ...prev, image_url: previewUrl, imageFile: file }))
        } else {
            setNewNominee(prev => ({ ...prev, image_url: previewUrl, imageFile: file }))
        }
    }

    async function uploadImageToSupabase(file) {
        try {
            setUploading(true)
            const fileExt = file.name.split('.').pop()
            const fileName = `${Math.random()}.${fileExt}`
            const filePath = `${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('nominee-images')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data } = supabase.storage
                .from('nominee-images')
                .getPublicUrl(filePath)

            return data.publicUrl
        } catch (error) {
            console.error('Error uploading image:', error)
            toast.error('Նկարի բեռնման սխալ')
            return null
        } finally {
            setUploading(false)
        }
    }

    async function toggleStatus() {
        const newStatus = config.status === 'active' ? 'closed' : 'active'

        const { error } = await supabase
            .from('voting_config')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', 1)

        if (error) {
            toast.error('Սխալ')
        } else {
            setConfig({ ...config, status: newStatus })
            toast.success(`Քվեարկությունը ${newStatus === 'active' ? 'բացված' : 'փակված'} է`)
        }
    }

    async function toggleResultsVisibility() {
        const newVisibility = !config.results_public

        // If making results public, also close voting
        const updates = {
            results_public: newVisibility,
            updated_at: new Date().toISOString()
        }

        if (newVisibility) {
            updates.status = 'closed'
        }

        const { error } = await supabase
            .from('voting_config')
            .update(updates)
            .eq('id', 1)

        if (error) {
            toast.error('Սխալ')
        } else {
            setConfig({ ...config, ...updates })
            if (newVisibility) {
                toast.success('Արդյունքները հրապարակված են և քվեարկությունը փակված է')
            } else {
                toast.success('Արդյունքները թաքցված են')
            }
        }
    }

    // ============================================
    // NOMINEE FUNCTIONS
    // ============================================
    async function addNominee() {
        if (!newNominee.name.trim()) {
            toast.error('Անունը պարտադիր է')
            return
        }

        if (!newNominee.image_url.trim()) {
            toast.error('Նկարը պարտադիր է')
            return
        }

        if (newNominee.description.length > MAX_DESCRIPTION_LENGTH) {
            toast.error(`Նկարագրությունը չպետք է գերազանցի ${MAX_DESCRIPTION_LENGTH} նիշը`)
            return
        }

        if (!newNominee.detailed_info || !newNominee.detailed_info.trim()) {
            toast.error('Մանրամասն տեղեկությունը պարտադիր է')
            return
        }

        if (newNominee.detailed_info.length > MAX_DETAILED_INFO_LENGTH) {
            toast.error(`Մանրամասն տեղեկությունը չպետք է գերազանցի ${MAX_DETAILED_INFO_LENGTH} նիշը`)
            return
        }

        let finalImageUrl = newNominee.image_url

        // Upload image if a new file was selected
        if (newNominee.imageFile) {
            finalImageUrl = await uploadImageToSupabase(newNominee.imageFile)
            if (!finalImageUrl) return // Upload failed
        }

        const { error } = await supabase
            .from('nominees')
            .insert([{
                config_id: 1,
                name: newNominee.name.trim(),
                description: newNominee.description.trim(),
                detailed_info: newNominee.detailed_info?.trim() || null,
                image_url: finalImageUrl,
                vote_count: 0
            }])

        if (error) {
            toast.error('Սխալ')
            console.error(error)
        } else {
            toast.success('Թեկնածուն ավելացված է')
            setNewNominee({ name: '', description: '', detailed_info: '', image_url: '', imageFile: null })
            setShowAddModal(false)
            fetchAllData()
        }
    }

    async function updateNominee(id) {
        if (!editingNominee.name.trim()) {
            toast.error('Անունը պարտադիր է')
            return
        }

        if (!editingNominee.image_url?.trim()) {
            toast.error('Նկարը պարտադիր է')
            return
        }

        if (editingNominee.description.length > MAX_DESCRIPTION_LENGTH) {
            toast.error(`Նկարագրությունը չպետք է գերազանցի ${MAX_DESCRIPTION_LENGTH} նիշը`)
            return
        }

        if (!editingNominee.detailed_info || !editingNominee.detailed_info.trim()) {
            toast.error('Մանրամասն տեղեկությունը պարտադիր է')
            return
        }

        if (editingNominee.detailed_info.length > MAX_DETAILED_INFO_LENGTH) {
            toast.error(`Մանրամասն տեղեկությունը չպետք է գերազանցի ${MAX_DETAILED_INFO_LENGTH} նիշը`)
            return
        }

        let finalImageUrl = editingNominee.image_url

        // Upload image if a new file was selected
        if (editingNominee.imageFile) {
            finalImageUrl = await uploadImageToSupabase(editingNominee.imageFile)
            if (!finalImageUrl) return // Upload failed
        }

        const { error } = await supabase
            .from('nominees')
            .update({
                name: editingNominee.name.trim(),
                description: editingNominee.description.trim(),
                detailed_info: editingNominee.detailed_info?.trim() || null,
                image_url: finalImageUrl
            })
            .eq('id', id)

        if (error) {
            toast.error('Սխալ')
            console.error(error)
        } else {
            toast.success('Թեկնածուն թարմացված է')
            setEditingNominee(null)
            setShowEditModal(false)
            fetchAllData()
        }
    }

    async function deleteNominee(id, name) {
        if (!confirm(`Ջնջե՞լ "${name}" թեկնածուին։`)) return

        const { error } = await supabase
            .from('nominees')
            .delete()
            .eq('id', id)

        if (error) {
            toast.error('Սխալ')
            console.error(error)
        } else {
            toast.success('Թեկնածուն ջնջված է')
            fetchAllData()
        }
    }

    // ============================================
    // CODE FUNCTIONS
    // ============================================
    async function generateCodes() {
        if (codeCount < MIN_CODE_COUNT || codeCount > MAX_CODE_COUNT) {
            toast.error(`Մուտքագրեք ${MIN_CODE_COUNT}-ից ${MAX_CODE_COUNT} միջակայքում թիվ`)
            return
        }

        setGenerating(true)

        try {
            const newCodes = generateUniqueCodes(codeCount)

            const codeRecords = newCodes.map(code => ({
                unique_code: code,
                config_id: 1,
                is_used: false
            }))

            const { error } = await supabase
                .from('voting_codes')
                .insert(codeRecords)

            if (error) throw error

            toast.success(`${codeCount} կոդ ստեղծված է`)
            fetchAllData()
            setCodeCount(10)
            setShowGenerateForm(false)
        } catch (error) {
            console.error('Generate codes error:', error)
            toast.error('Սերվերի սխալ')
        } finally {
            setGenerating(false)
        }
    }

    function exportCodes() {
        const unusedCodes = codes.filter(c => !c.is_used)
        const codeText = unusedCodes.map(c => c.unique_code).join('\n')

        const blob = new Blob([codeText], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `voting-codes-${new Date().toISOString().split('T')[0]}.txt`
        a.click()
        URL.revokeObjectURL(url)

        toast.success('Կոդերը արտահանված են')
    }

    // ============================================
    // CHANGE PASSWORD FUNCTION
    // ============================================
    async function handleChangePassword() {
        if (!newPassword || !confirmNewPassword) {
            toast.error('Լրացրեք բոլոր դաշտերը')
            return
        }

        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            toast.error(`Գաղտնաբառը պետք է լինի առնվազն ${MIN_PASSWORD_LENGTH} նիշ`)
            return
        }

        if (newPassword !== confirmNewPassword) {
            toast.error('Գաղտնաբառերը չեն համընկնում')
            return
        }

        setChangingPassword(true)

        const result = await updatePassword(newPassword)

        if (result.success) {
            toast.success('Գաղտնաբառը փոխված է')
            setShowChangePasswordModal(false)
            setNewPassword('')
            setConfirmNewPassword('')
        } else {
            toast.error(result.error)
        }

        setChangingPassword(false)
    }

    // ============================================
    // COMPUTED VALUES
    // ============================================
    const totalVotes = nominees.reduce((sum, n) => sum + n.vote_count, 0)

    const codeStats = {
        total: codes.length,
        used: codes.filter(c => c.is_used).length,
        unused: codes.filter(c => !c.is_used).length
    }

    const filteredCodes = codes.filter(code => {
        const matchesSearch = code.code.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesFilter =
            filterStatus === 'all' ? true :
                filterStatus === 'used' ? code.is_used :
                    !code.is_used
        return matchesSearch && matchesFilter
    })

    // Pagination
    const indexOfLastItem = currentPage * itemsPerPage
    const indexOfFirstItem = indexOfLastItem - itemsPerPage
    const currentCodes = filteredCodes.slice(indexOfFirstItem, indexOfLastItem)

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <span className="spinner"></span>
            </div>
        )
    }

    if (!config) {
        return (
            <div className="card text-center py-12">
                <p className="text-fade-600">Կարգավորումներ չեն գտնվել</p>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* ============================================ */}
            {/* SECTION 1: NOMINEES */}
            {/* ============================================ */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-semibold">Թեկնածուներ</h2>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="btn btn-primary"
                    >
                        + Ավելացնել թեկնածու
                    </button>
                </div>


                {/* Nominees Grid */}
                {nominees.length === 0 ? (
                    <div className="card text-center py-12">
                        <p className="text-fade-600">Թեկնածուներ չկան</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {nominees.map((nominee) => {
                            const percentage = totalVotes > 0 ? ((nominee.vote_count / totalVotes) * 100).toFixed(1) : 0

                            return (
                                <div key={nominee.id} className="card hover:shadow-lg transition-shadow">
                                    {/* Image */}
                                    {nominee.image_url && (
                                        <div className="w-full aspect-square rounded-t-lg overflow-hidden bg-fade-100 relative">
                                            <img
                                                src={nominee.image_url}
                                                alt={nominee.name}
                                                className="w-full h-full object-cover"
                                                onError={(e) => e.target.style.display = 'none'}
                                            />
                                            {/* Three-dot menu on image */}
                                            <div className="absolute top-2 right-2">
                                                <DropdownMenu
                                                    trigger={
                                                        <button className="bg-white bg-opacity-90 hover:bg-opacity-100 p-2 rounded-full shadow-lg transition-all">
                                                            <svg className="w-5 h-5 text-fade-700" fill="currentColor" viewBox="0 0 20 20">
                                                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                                            </svg>
                                                        </button>
                                                    }
                                                    items={[
                                                        {
                                                            icon: '',
                                                            label: 'Խմբագրել',
                                                            onClick: () => {
                                                                setEditingNominee({ ...nominee })
                                                                setShowEditModal(true)
                                                            }
                                                        },
                                                        {
                                                            icon: '',
                                                            label: 'Ջնջել',
                                                            onClick: () => deleteNominee(nominee.id, nominee.name),
                                                            danger: true
                                                        }
                                                    ]}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Content */}
                                    <div className="space-y-3 p-4">
                                        <h3 className="text-xl font-semibold text-text-dark">
                                            {nominee.name}
                                        </h3>
                                        {nominee.description && (
                                            <p className="text-sm text-fade-600 whitespace-pre-line">{nominee.description}</p>
                                        )}

                                        {/* Vote Stats */}
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-2xl font-bold text-brand-500">
                                                    {nominee.vote_count}
                                                </span>
                                                <span className="text-lg font-semibold text-fade-600">
                                                    {percentage}%
                                                </span>
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="w-full bg-fade-200 rounded-full h-3">
                                                <div
                                                    className="bg-brand-500 h-3 rounded-full transition-all duration-500"
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* ============================================ */}
            {/* SECTION 2: CODE STATISTICS */}
            {/* ============================================ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card bg-blue-50 text-center">
                    <div className="text-sm text-fade-600">Ընդհանուր</div>
                    <div className="text-3xl font-semibold text-brand-500">{codeStats.total}</div>
                </div>
                <div className="card bg-green-50 text-center">
                    <div className="text-sm text-fade-600">Քվեարկած</div>
                    <div className="text-3xl font-semibold text-brand-500">{codeStats.used}</div>
                </div>
                <div className="card bg-yellow-50 text-center">
                    <div className="text-sm text-fade-600">Չքվեարկած</div>
                    <div className="text-3xl font-semibold text-accent-yellow-dark">{codeStats.unused}</div>
                </div>
            </div>

            {/* ============================================ */}
            {/* SECTION 3: EMAIL MANAGER */}
            {/* ============================================ */}
            <div className="space-y-4">
                <h2 className="text-2xl font-semibold">Էլ․ հասցեների կառավարում</h2>

                <div className="card bg-white">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Upload Section */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg">Նոր ուղարկում</h3>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-fade-700">
                                    Բեռնել էլ․ հասցեների ցուցակ (TXT/CSV)
                                </label>

                                {/* Hidden Input */}
                                <input
                                    id="email-file-input"
                                    type="file"
                                    accept=".txt,.csv"
                                    onChange={(e) => setEmailFile(e.target.files[0])}
                                    className="hidden"
                                    disabled={uploadingEmails}
                                />

                                {/* Custom UI */}
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => document.getElementById('email-file-input').click()}
                                        className="px-4 py-2 rounded-full bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        disabled={uploadingEmails}
                                    >
                                        Ընտրել ֆայլ
                                    </button>
                                    <span className="text-sm text-fade-500 truncate flex-1">
                                        {emailFile ? emailFile.name : 'Ֆայլ ընտրված չէ'}
                                    </span>
                                </div>

                                <p className="text-xs text-fade-500">
                                    Ֆայլը պետք է պարունակի էլ․ հասցեներ՝ առանձնացված նոր տողով կամ ստորակետով։
                                </p>
                            </div>

                            <button
                                onClick={handleEmailUpload}
                                disabled={!emailFile || uploadingEmails}
                                className="btn btn-primary w-full"
                            >
                                {uploadingEmails ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="spinner"></span>
                                        Մշակվում է...
                                    </span>
                                ) : (
                                    'Սկսել ուղարկել'
                                )}
                            </button>

                            {/* Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
                                <div className="bg-green-50 p-2 rounded text-center">
                                    <div className="text-xs text-fade-600">Ուղարկված</div>
                                    <div className="font-bold text-brand-500">{emailStats.sent}</div>
                                </div>
                                <div className="bg-orange-50 p-2 rounded text-center">
                                    <div className="text-xs text-fade-600">Սպասում է</div>
                                    <div className="font-bold text-orange-600">{emailStats.pending}</div>
                                </div>
                                <div className="bg-red-50 p-2 rounded text-center">
                                    <div className="text-xs text-fade-600">Ձախողված</div>
                                    <div className="font-bold text-error-dark">{emailStats.failed}</div>
                                </div>
                                <div className="bg-blue-50 p-2 rounded text-center">
                                    <div className="text-xs text-fade-600">Ընդհանուր</div>
                                    <div className="font-bold text-blue-600">{emailStats.total}</div>
                                </div>
                            </div>
                        </div>

                        {/* Logs Section */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="font-semibold text-lg">Ձախողված էլ․ հասցեներ</h3>
                                <button
                                    onClick={fetchCodes}
                                    className="text-sm text-brand-500 hover:underline"
                                >
                                    Թարմացնել
                                </button>
                            </div>

                            <div className="bg-fade-50 rounded-lg p-4 h-64 overflow-y-auto space-y-2 border border-fade-200">
                                {emailLogs.length === 0 ? (
                                    <p className="text-center text-fade-500 py-8">Գրառումներ չկան</p>
                                ) : (
                                    emailLogs.map((log) => (
                                        <div key={log.id} className="text-sm flex justify-between items-start border-b border-fade-100 pb-2 last:border-0">
                                            <div className="flex-1">
                                                <div className="font-medium text-fade-800">{log.email}</div>
                                                <div className="text-xs text-fade-500">Կոդ: {log.code}</div>
                                                {log.email_error && (
                                                    <div className="text-xs text-error-light mt-1">{log.email_error}</div>
                                                )}
                                                <div className="text-xs text-fade-400">
                                                    {new Date(log.created_at).toLocaleTimeString()}
                                                </div>
                                            </div>
                                            {log.email_status === 'failed' && (
                                                <DropdownMenu
                                                    trigger={
                                                        <button className="p-1 hover:bg-fade-100 rounded">
                                                            <svg className="w-5 h-5 text-fade-600" fill="currentColor" viewBox="0 0 20 20">
                                                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                                            </svg>
                                                        </button>
                                                    }
                                                    items={[
                                                        {
                                                            label: 'Խմբագրել',
                                                            onClick: () => {
                                                                setEditingEmail(log)
                                                                setShowEditEmailModal(true)
                                                            }
                                                        },
                                                        {
                                                            label: 'Կրկին ուղարկել',
                                                            onClick: async () => {
                                                                try {
                                                                    const { error } = await supabase
                                                                        .from('voting_codes')
                                                                        .update({
                                                                            email_status: 'pending',
                                                                            email_error: null,
                                                                            email_sent_at: null
                                                                        })
                                                                        .eq('id', log.id)

                                                                    if (error) throw error

                                                                    toast.success('Ավելացվեց հերթում')
                                                                    fetchCodes()
                                                                    api.triggerEmailProcess().catch(console.error)
                                                                } catch (error) {
                                                                    console.error('Resend error:', error)
                                                                    toast.error('Սխալ')
                                                                }
                                                            }
                                                        },
                                                        {
                                                            label: 'Անտեսել',
                                                            onClick: async () => {
                                                                try {
                                                                    const { error } = await supabase
                                                                        .from('voting_codes')
                                                                        .update({
                                                                            email_status: 'sent',
                                                                            email_error: null,
                                                                            email_sent_at: new Date().toISOString()
                                                                        })
                                                                        .eq('id', log.id)

                                                                    if (error) throw error

                                                                    toast.success('Անտեսված է')
                                                                    fetchCodes()
                                                                } catch (error) {
                                                                    console.error('Ignore error:', error)
                                                                    toast.error('Սխալ')
                                                                }
                                                            }
                                                        },
                                                        {
                                                            label: 'Ջնջել',
                                                            onClick: async () => {
                                                                if (!confirm('Ջնջե՞լ այս գրառումը')) return

                                                                try {
                                                                    const { error } = await supabase
                                                                        .from('voting_codes')
                                                                        .delete()
                                                                        .eq('id', log.id)

                                                                    if (error) throw error

                                                                    toast.success('Ջնջված է')
                                                                    fetchCodes()
                                                                } catch (error) {
                                                                    console.error('Delete error:', error)
                                                                    toast.error('Սխալ')
                                                                }
                                                            },
                                                            danger: true
                                                        }
                                                    ]}
                                                />
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ============================================ */}
            {/* SECTION 4: DANGER ZONE */}
            {/* ============================================ */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-error-dark">Վտանգավոր գոտի</h2>

                <div className="card border-2 border-red-200 bg-red-50">
                    <div className="space-y-4">
                        {/* Voting Status */}
                        <div className="flex items-center justify-between py-3 border-b border-red-200">
                            <div>
                                <h3 className="text-base font-semibold text-text-dark">Քվեարկության կարգավիճակ</h3>
                                <p className="text-sm text-fade-600">
                                    {config.results_public
                                        ? '⚠️ Նախ թաքցրեք արդյունքները'
                                        : 'Փակել կամ բացել քվեարկությունը'
                                    }
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    if (config.results_public) {
                                        toast.error('Նախ թաքցրեք արդյունքները, որպեսզի կարողանաք բացել քվեարկությունը')
                                        return
                                    }
                                    const newStatus = config.status === 'active' ? 'closed' : 'active'
                                    supabase
                                        .from('voting_config')
                                        .update({ status: newStatus, updated_at: new Date().toISOString() })
                                        .eq('id', 1)
                                        .then(({ error }) => {
                                            if (error) {
                                                toast.error('Սխալ')
                                            } else {
                                                setConfig({ ...config, status: newStatus })
                                                toast.success(`Քվեարկությունը ${newStatus === 'active' ? 'բացված' : 'փակված'} է`)
                                            }
                                        })
                                }}
                                disabled={config.results_public}
                                style={{
                                    backgroundColor: config.results_public ? 'rgb(156 163 175 / 30%)' : 'rgb(220 38 38 / 19%)',
                                    color: config.results_public ? 'rgb(107 114 128)' : 'rgb(220 38 38)',
                                    cursor: config.results_public ? 'not-allowed' : 'pointer'
                                }}
                                className="px-4 py-2 rounded-lg font-semibold transition-colors hover:opacity-80"
                            >
                                {config.status === 'active' ? 'Փակել' : 'Ակտիվացնել'}
                            </button>
                        </div>

                        {/* Results Visibility */}
                        <div className="flex items-center justify-between py-3 border-b border-red-200">
                            <div>
                                <h3 className="text-base font-semibold text-text-dark">Արդյունքների տեսանելիություն</h3>
                                <p className="text-sm text-fade-600">Հրապարակել կամ թաքցնել արդյունքները</p>
                            </div>
                            <button
                                onClick={async () => {
                                    const newVisibility = !config.results_public

                                    const { error } = await supabase
                                        .from('voting_config')
                                        .update({ results_public: newVisibility, updated_at: new Date().toISOString() })
                                        .eq('id', 1)

                                    if (error) {
                                        toast.error('Սխալ')
                                    } else {
                                        // Fetch the updated config to get the auto-closed status
                                        const { data: updatedConfig } = await supabase
                                            .from('voting_config')
                                            .select('*')
                                            .eq('id', 1)
                                            .single()

                                        if (updatedConfig) {
                                            setConfig(updatedConfig)
                                            if (newVisibility) {
                                                toast.success('Արդյունքները հրապարակված են և քվեարկությունը փակված է')
                                            } else {
                                                toast.success('Արդյունքները թաքցված են')
                                            }
                                        }
                                    }
                                }}
                                style={{ backgroundColor: 'rgb(220 38 38 / 19%)', color: 'rgb(220 38 38)' }}
                                className="px-4 py-2 rounded-lg font-semibold transition-colors hover:opacity-80"
                            >
                                {config.results_public ? 'Թաքցնել' : 'Հրապարակել'}
                            </button>
                        </div>

                        {/* Scheduled Closing Time */}
                        <div className="flex items-center justify-between py-3 border-b border-red-200">
                            <div className="flex-1">
                                <h3 className="text-base font-semibold text-text-dark">Ավտոմատ փակում</h3>
                                <p className="text-sm text-fade-600 mb-2">Նշեք ամսաթիվ և ժամ՝ քվեարկությունը ավտոմատ փակելու համար</p>
                                {config.closing_time && (
                                    <p className="text-xs text-brand-500 font-medium">
                                        📅 Կփակվի: {new Date(config.closing_time).toLocaleString('hy-AM', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="datetime-local"
                                    value={config.closing_time ? (() => {
                                        // Convert UTC to local time for display
                                        const date = new Date(config.closing_time);
                                        // Get local time in YYYY-MM-DDTHH:mm format
                                        const year = date.getFullYear();
                                        const month = String(date.getMonth() + 1).padStart(2, '0');
                                        const day = String(date.getDate()).padStart(2, '0');
                                        const hours = String(date.getHours()).padStart(2, '0');
                                        const minutes = String(date.getMinutes()).padStart(2, '0');
                                        return `${year}-${month}-${day}T${hours}:${minutes}`;
                                    })() : ''}
                                    onChange={async (e) => {
                                        if (!e.target.value) {
                                            // Clear the closing time
                                            const { error } = await supabase
                                                .from('voting_config')
                                                .update({ closing_time: null, updated_at: new Date().toISOString() })
                                                .eq('id', 1)

                                            if (error) {
                                                toast.error('Սխալ')
                                            } else {
                                                setConfig({ ...config, closing_time: null })
                                                toast.success('Փակման ժամանակը հեռացված է')
                                            }
                                            return;
                                        }

                                        // datetime-local gives us local time
                                        const selectedDate = new Date(e.target.value);
                                        const now = new Date();

                                        // Validate: must be in the future (local time comparison)
                                        if (selectedDate <= now) {
                                            toast.error('Ամսաթիվը պետք է լինի ապագայում');
                                            return;
                                        }

                                        // Convert to UTC for storage
                                        const newTime = selectedDate.toISOString();

                                        const { error } = await supabase
                                            .from('voting_config')
                                            .update({ closing_time: newTime, updated_at: new Date().toISOString() })
                                            .eq('id', 1)

                                        if (error) {
                                            toast.error('Սխալ: ' + error.message)
                                        } else {
                                            setConfig({ ...config, closing_time: newTime })
                                            toast.success('Փակման ժամանակը սահմանված է')
                                        }
                                    }}
                                    className="px-3 py-2 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                />
                                {config.closing_time && (
                                    <button
                                        onClick={async () => {
                                            const { error } = await supabase
                                                .from('voting_config')
                                                .update({ closing_time: null, updated_at: new Date().toISOString() })
                                                .eq('id', 1)

                                            if (error) {
                                                toast.error('Սխալ')
                                            } else {
                                                setConfig({ ...config, closing_time: null })
                                                toast.success('Փակման ժամանակը հեռացված է')
                                            }
                                        }}
                                        style={{ backgroundColor: 'rgb(220 38 38 / 19%)', color: 'rgb(220 38 38)' }}
                                        className="px-3 py-2 rounded-lg font-semibold transition-colors hover:opacity-80 text-sm"
                                    >
                                        Մաքրել
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Change Password */}
                        <div className="flex items-center justify-between py-3 border-b border-red-200">
                            <div>
                                <h3 className="text-base font-semibold text-text-dark">Փոխել գաղտնաբառը</h3>
                                <p className="text-sm text-fade-600">Թարմացնել ադմինիստրատորի գաղտնաբառը</p>
                            </div>
                            <button
                                onClick={() => setShowChangePasswordModal(true)}
                                style={{ backgroundColor: 'rgb(220 38 38 / 19%)', color: 'rgb(220 38 38)' }}
                                className="px-4 py-2 rounded-lg font-semibold transition-colors hover:opacity-80"
                            >
                                Փոխել
                            </button>
                        </div>

                        {/* Reset All Data */}
                        <div className="flex items-center justify-between py-3">
                            <div>
                                <h3 className="text-base font-semibold text-text-dark">Ջնջել բոլոր տվյալները</h3>
                                <p className="text-sm text-fade-600">Ջնջել բոլոր թեկնածուներին, կոդերը և վերականգնել կարգավորումները</p>
                            </div>
                            <button
                                onClick={async () => {
                                    if (!confirm('Վստա՞հ եք, որ ցանկանում եք ջնջել բոլոր տվյալները։ Այս գործողությունը անդառնալի է։')) return

                                    try {
                                        const { error } = await supabase.rpc('reset_all_voting_data')

                                        if (error) throw error

                                        toast.success('Բոլոր տվյալները ջնջված են')
                                        fetchAllData()
                                    } catch (error) {
                                        console.error('Reset error:', error)
                                        toast.error('Սխալ տվյալները ջնջելիս')
                                    }
                                }}
                                style={{ backgroundColor: 'rgb(220 38 38 / 19%)', color: 'rgb(220 38 38)' }}
                                className="px-4 py-2 rounded-lg font-semibold transition-colors hover:opacity-80"
                            >
                                Ջնջել ամեն ինչ
                            </button>
                        </div>
                    </div>
                </div>
            </div>


            {/* Add Nominee Modal */}
            <Modal
                isOpen={showAddModal}
                onClose={() => {
                    setShowAddModal(false)
                    setNewNominee({ name: '', description: '', detailed_info: '', image_url: '', imageFile: null })
                }}
                title="Ավելացնել Թեկնածու"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-fade-700 mb-1">Անուն</label>
                        <input
                            type="text"
                            value={newNominee.name}
                            onChange={(e) => setNewNominee({ ...newNominee, name: e.target.value })}
                            className="input-field"
                            placeholder="Օրինակ՝ Վարդան"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-fade-700 mb-1">Նկարագրություն</label>
                        <textarea
                            value={newNominee.description}
                            onChange={(e) => setNewNominee({ ...newNominee, description: e.target.value })}
                            className="input-field"
                            rows="3"
                            placeholder="Մինչև 150 նիշ"
                            maxLength={150}
                        />
                        <div className="text-right text-xs text-fade-500 mt-1">
                            {newNominee.description.length}/150
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-fade-700 mb-1">Մանրամասն տեղեկություն</label>
                        <textarea
                            value={newNominee.detailed_info}
                            onChange={(e) => setNewNominee({ ...newNominee, detailed_info: e.target.value })}
                            className="input-field"
                            rows="6"
                            placeholder="Մինչև 1000 նիշ - Կցուցադրվի մոդալ պատուհանում"
                            maxLength={1000}
                        />
                        <div className="text-right text-xs text-fade-500 mt-1">
                            {newNominee.detailed_info?.length || 0}/1000
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-fade-700 mb-1">Նկար</label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-fade-200 border-dashed rounded-lg hover:border-brand-500 transition-colors cursor-pointer relative bg-fade-50 hover:bg-fade-100">
                            <div className="space-y-1 text-center">
                                {newNominee.image_url ? (
                                    <div className="relative">
                                        <img
                                            src={newNominee.image_url}
                                            alt="Preview"
                                            className="mx-auto h-32 object-cover rounded-lg"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 opacity-0 hover:opacity-100 transition-opacity rounded-lg">
                                            <span className="text-white text-sm font-medium">Փոխել նկարը</span>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <svg
                                            className="mx-auto h-12 w-12 text-fade-400"
                                            stroke="currentColor"
                                            fill="none"
                                            viewBox="0 0 48 48"
                                            aria-hidden="true"
                                        >
                                            <path
                                                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                                                strokeWidth={2}
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                        <div className="flex text-sm text-fade-600 justify-center">
                                            <span className="relative cursor-pointer bg-fade-white rounded-md font-medium text-brand-500 hover:text-brand-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-brand-500">
                                                <span>Բեռնել նկար</span>
                                            </span>
                                        </div>
                                        <p className="text-xs text-fade-500">PNG, JPG, GIF մինչև 5MB</p>
                                    </>
                                )}
                                <input
                                    type="file"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    accept="image/*"
                                    onChange={(e) => {
                                        const file = e.target.files[0]
                                        if (file) handleImageSelect(file, false)
                                    }}
                                    disabled={uploading}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="pt-4 flex gap-3">
                        <button
                            onClick={() => {
                                setShowAddModal(false)
                                setNewNominee({ name: '', description: '', detailed_info: '', image_url: '', imageFile: null })
                            }}
                            className="btn btn-outline flex-1"
                            disabled={uploading}
                        >
                            Չեղարկել
                        </button>
                        <button
                            onClick={addNominee}
                            className="btn btn-primary flex-1"
                            disabled={uploading}
                        >
                            {uploading ? 'Բեռնում...' : 'Ավելացնել'}
                        </button>
                    </div>            </div>
            </Modal>

            {/* Edit Nominee Modal */}
            <Modal
                isOpen={showEditModal}
                onClose={() => {
                    setShowEditModal(false)
                    setEditingNominee(null)
                }}
                title="Խմբագրել Թեկնածուին"
            >
                {editingNominee && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-fade-700 mb-1">Անուն</label>
                            <input
                                type="text"
                                value={editingNominee.name}
                                onChange={(e) => setEditingNominee({ ...editingNominee, name: e.target.value })}
                                className="input-field"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-fade-700 mb-1">Նկարագրություն</label>
                            <textarea
                                value={editingNominee.description}
                                onChange={(e) => setEditingNominee({ ...editingNominee, description: e.target.value })}
                                className="input-field"
                                rows="3"
                                maxLength={150}
                            />
                            <div className="text-right text-xs text-fade-500 mt-1">
                                {editingNominee.description.length}/150
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-fade-700 mb-1">Մանրամասն տեղեկություն</label>
                            <textarea
                                value={editingNominee.detailed_info || ''}
                                onChange={(e) => setEditingNominee({ ...editingNominee, detailed_info: e.target.value })}
                                className="input-field"
                                rows="6"
                                placeholder="Մինչև 1000 նիշ - Կցուցադրվի մոդալ պատուհանում"
                                maxLength={1000}
                            />
                            <div className="text-right text-xs text-fade-500 mt-1">
                                {editingNominee.detailed_info?.length || 0}/1000
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-fade-700 mb-1">Նկար</label>
                            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-fade-200 border-dashed rounded-lg hover:border-brand-500 transition-colors cursor-pointer relative bg-fade-50 hover:bg-fade-100">
                                <div className="space-y-1 text-center">
                                    {editingNominee.image_url ? (
                                        <div className="relative">
                                            <img
                                                src={editingNominee.image_url}
                                                alt="Preview"
                                                className="mx-auto h-32 object-cover rounded-lg"
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 opacity-0 hover:opacity-100 transition-opacity rounded-lg">
                                                <span className="text-white text-sm font-medium">Փոխել նկարը</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <svg
                                                className="mx-auto h-12 w-12 text-fade-400"
                                                stroke="currentColor"
                                                fill="none"
                                                viewBox="0 0 48 48"
                                                aria-hidden="true"
                                            >
                                                <path
                                                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                                                    strokeWidth={2}
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                            <div className="flex text-sm text-fade-600 justify-center">
                                                <span className="relative cursor-pointer bg-fade-white rounded-md font-medium text-brand-500 hover:text-brand-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-brand-500">
                                                    <span>Բեռնել նկար</span>
                                                </span>
                                            </div>
                                            <p className="text-xs text-fade-500">PNG, JPG, GIF մինչև 5MB</p>
                                        </>
                                    )}
                                    <input
                                        type="file"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files[0]
                                            if (file) handleImageSelect(file, true)
                                        }}
                                        disabled={uploading}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="pt-4 flex gap-3">
                            <button
                                onClick={() => {
                                    setShowEditModal(false)
                                    setEditingNominee(null)
                                }}
                                className="btn btn-outline flex-1"
                                disabled={uploading}
                            >
                                Չեղարկել
                            </button>
                            <button
                                onClick={() => updateNominee(editingNominee.id)}
                                className="btn btn-primary flex-1"
                                disabled={uploading}
                            >
                                {uploading ? 'Բեռնում...' : 'Պահպանել'}
                            </button>
                        </div>            </div>
                )}
            </Modal>

            {/* Change Password Modal */}
            <Modal
                isOpen={showChangePasswordModal}
                onClose={() => {
                    setShowChangePasswordModal(false)
                    setNewPassword('')
                    setConfirmNewPassword('')
                }}
                title="Փոխել գաղտնաբառը"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-fade-700 mb-1">Նոր գաղտնաբառ</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="input-field"
                            placeholder="Առնվազն 6 նիշ"
                            disabled={changingPassword}
                            autoComplete="new-password"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-fade-700 mb-1">Հաստատել գաղտնաբառը</label>
                        <input
                            type="password"
                            value={confirmNewPassword}
                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                            className="input-field"
                            placeholder="Կրկնեք գաղտնաբառը"
                            disabled={changingPassword}
                            autoComplete="new-password"
                        />
                    </div>
                    <div className="pt-4 flex gap-3">
                        <button
                            onClick={() => {
                                setShowChangePasswordModal(false)
                                setNewPassword('')
                                setConfirmNewPassword('')
                            }}
                            className="btn btn-outline flex-1"
                            disabled={changingPassword}
                        >
                            Չեղարկել
                        </button>
                        <button
                            onClick={handleChangePassword}
                            className="btn btn-primary flex-1"
                            disabled={changingPassword}
                        >
                            {changingPassword ? 'Պահպանում...' : 'Փոխել գաղտնաբառը'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Edit Email Modal */}
            <Modal
                isOpen={showEditEmailModal}
                onClose={() => {
                    setShowEditEmailModal(false)
                    setEditingEmail(null)
                }}
                title="Խմբագրել էլ․ հասցեն"
            >
                {editingEmail && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-fade-700 mb-1">Էլ․ հասցե</label>
                            <input
                                type="email"
                                value={editingEmail.email}
                                onChange={(e) => setEditingEmail({ ...editingEmail, email: e.target.value })}
                                className="input-field"
                                placeholder="example@email.com"
                            />
                        </div>
                        <div className="pt-4 flex gap-3">
                            <button
                                onClick={() => {
                                    setShowEditEmailModal(false)
                                    setEditingEmail(null)
                                }}
                                className="btn btn-outline flex-1"
                            >
                                Չեղարկել
                            </button>
                            <button
                                onClick={async () => {
                                    try {
                                        // Validate email format
                                        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
                                        if (!emailRegex.test(editingEmail.email)) {
                                            toast.error('Անվավեր էլ․ հասցեի ֆորմատ')
                                            return
                                        }

                                        const { error } = await supabase
                                            .from('voting_codes')
                                            .update({
                                                email: editingEmail.email,
                                                email_status: 'pending',
                                                email_error: null,
                                                email_sent_at: null
                                            })
                                            .eq('id', editingEmail.id)

                                        if (error) throw error

                                        toast.success('Էլ․ հասցեն թարմացվեց և ավելացվեց հերթում')
                                        setShowEditEmailModal(false)
                                        setEditingEmail(null)
                                        fetchCodes()
                                        api.triggerEmailProcess().catch(console.error)
                                    } catch (error) {
                                        console.error('Update error:', error)
                                        toast.error('Սխալ: ' + error.message)
                                    }
                                }}
                                className="btn btn-primary flex-1"
                            >
                                Պահպանել և ուղարկել
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div >
    )
}
