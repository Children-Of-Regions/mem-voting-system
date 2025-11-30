import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { isValidCodeFormat } from '../utils/codeGenerator'
import toast, { Toaster } from 'react-hot-toast'

export default function VotingPage() {
    const [code, setCode] = useState('')
    const [codeValidated, setCodeValidated] = useState(false)
    const [session, setSession] = useState(null)
    const [nominees, setNominees] = useState([])
    const [selectedNominee, setSelectedNominee] = useState(null)
    const [loading, setLoading] = useState(false)
    const [voting, setVoting] = useState(false)
    const [results, setResults] = useState(null)
    const [showResults, setShowResults] = useState(false)
    const [initialLoading, setInitialLoading] = useState(true)
    const [fadeOut, setFadeOut] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const [modalMessage, setModalMessage] = useState('')
    const [modalType, setModalType] = useState('success') // 'success' or 'error'

    // Check for active session and results on mount
    useEffect(() => {
        checkActiveSession()

        // Check if code is in URL parameter
        const urlParams = new URLSearchParams(window.location.search)
        const codeFromUrl = urlParams.get('code')
        if (codeFromUrl) {
            const normalizedCode = codeFromUrl.toUpperCase()
            setCode(normalizedCode)
            // Auto validate if code exists
            validateCode(normalizedCode)
        }
    }, [])

    async function checkActiveSession() {
        const startTime = Date.now()

        const { data, error } = await supabase
            .from('voting_config')
            .select('*')
            .eq('id', 1)
            .single()

        if (data) {
            setSession(data)

            // Only show results if results are public
            if (data.results_public) {
                await fetchResults()
                setShowResults(true)
            }
        }

        // Ensure loading screen shows for at least 800ms for smooth experience
        const elapsedTime = Date.now() - startTime
        const minDisplayTime = 800
        const remainingTime = Math.max(0, minDisplayTime - elapsedTime)

        setTimeout(() => {
            // Start fade out animation
            setFadeOut(true)
            // Remove loading screen after fade animation completes
            setTimeout(() => {
                setInitialLoading(false)
            }, 500) // Match this with CSS transition duration
        }, remainingTime)
    }

    async function fetchResults() {
        const { data, error } = await supabase
            .from('nominees')
            .select('*')
            .eq('config_id', 1)
            .order('vote_count', { ascending: false })

        if (data) {
            const totalVotes = data.reduce((sum, n) => sum + n.vote_count, 0)
            setResults({ nominees: data, totalVotes })
        }
    }

    async function validateCode(codeOverride) {
        const codeToUse = typeof codeOverride === 'string' ? codeOverride : code

        if (!codeToUse.trim()) {
            setModalMessage('Խնդրում ենք մուտքագրել կոդը')
            setModalType('error')
            setShowModal(true)
            return
        }

        if (!isValidCodeFormat(codeToUse.toUpperCase())) {
            setModalMessage('Անվավեր կոդի ֆորմատ')
            setModalType('error')
            setShowModal(true)
            return
        }

        setLoading(true)

        try {
            // Check if code exists and is not used via secure RPC
            const { data: validationResult, error: validationError } = await supabase
                .rpc('check_voting_code', { code_input: codeToUse.toUpperCase() })

            if (validationError) {
                console.error('Validation error:', validationError)
                setModalMessage('Սերվերի սխալ')
                setModalType('error')
                setShowModal(true)
                setLoading(false)
                return
            }

            if (!validationResult.valid) {
                setModalMessage(validationResult.message)
                setModalType('error')
                setShowModal(true)
                setLoading(false)
                return
            }

            // Get voting config
            const { data: configData, error: configError } = await supabase
                .from('voting_config')
                .select('*')
                .eq('id', 1)
                .single()

            if (configError || !configData || configData.status !== 'active') {
                setModalMessage('Քվեարկությունը փակ է')
                setModalType('error')
                setShowModal(true)
                setLoading(false)
                return
            }

            // Fetch nominees
            const { data: nomineesData, error: nomineesError } = await supabase
                .from('nominees')
                .select('*')
                .eq('config_id', 1)

            if (nomineesError) {
                setModalMessage('Սերվերի սխալ')
                setModalType('error')
                setShowModal(true)
                setLoading(false)
                return
            }

            // Shuffle nominees to avoid bias
            const shuffledNominees = [...nomineesData].sort(() => Math.random() - 0.5)

            setSession(configData)
            setNominees(shuffledNominees)
            setCodeValidated(true)
        } catch (error) {
            console.error('Validation error:', error)
            setModalMessage('Սերվերի սխալ')
            setModalType('error')
            setShowModal(true)
        } finally {
            setLoading(false)
        }
    }

    async function submitVote() {
        if (!selectedNominee) {
            setModalMessage('Խնդրում ենք ընտրել թեկնածու')
            setModalType('error')
            setShowModal(true)
            return
        }

        setVoting(true)

        try {
            // Call the database function to use the code atomically
            const { data, error } = await supabase.rpc('submit_vote', {
                code_input: code.toUpperCase(),
                nominee_id: selectedNominee
            })

            if (error) {
                setModalMessage('Սերվերի սխալ')
                setModalType('error')
                setShowModal(true)
                console.error('Vote error:', error)
                setVoting(false)
                return
            }

            if (data.success) {
                setModalMessage(data.message)
                setModalType('success')
                setShowModal(true)
                // Reset state after modal is closed
                setTimeout(() => {
                    setCode('')
                    setCodeValidated(false)
                    setSelectedNominee(null)
                    setNominees([])
                    setSession(null)
                }, 3000)
            } else {
                setModalMessage(data.error)
                setModalType('error')
                setShowModal(true)
            }
        } catch (error) {
            console.error('Vote submission error:', error)
            setModalMessage('Սերվերի սխալ')
            setModalType('error')
            setShowModal(true)
        } finally {
            setVoting(false)
        }
    }

    // Show loading screen while checking session status
    if (initialLoading) {
        return (
            <div className={`min-h-screen bg-gray-50 flex items-center justify-center px-4 transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}>
                <div className="text-center fade-in">
                    <img
                        src="/header-logo.png"
                        alt="Logo"
                        className="mx-auto mb-6 w-64 sm:w-72 md:w-80 lg:w-96 h-auto"
                    />
                    <div className="flex items-center justify-center gap-3">
                        <span className="spinner"></span>
                        <span className="text-gray-600 text-lg">Բեռնում...</span>
                    </div>
                </div>
            </div>
        )
    }

    if (showResults && results) {
        return (
            <div className="min-h-screen bg-gray-50 py-8 px-4">
                <Toaster position="top-center" />
                <div className="container-custom max-w-6xl">
                    <div className="text-center fade-in">
                        <img
                            src="/header-logo.png"
                            alt="Logo"
                            className="mx-auto mb-6 w-64 sm:w-72 md:w-80 lg:w-96 h-auto"
                        />
                    </div>

                    <div className="flex flex-wrap justify-center gap-6 fade-in">
                        {results.nominees.map((nominee, index) => {
                            const percentage = results.totalVotes > 0
                                ? ((nominee.vote_count / results.totalVotes) * 100).toFixed(1)
                                : 0

                            const isWinner = index === 0

                            return (
                                <div
                                    key={nominee.id}
                                    className={`nominee-card w-full md:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] relative overflow-hidden cursor-default hover:shadow-lg transition-all duration-300 border-4 border-yellow-400 ${isWinner ? 'shadow-xl transform scale-[1.02] ring-2 ring-yellow-400 ring-offset-2' : ''
                                        }`}
                                >
                                    {/* Rank Badge */}
                                    <div className={`absolute top-2 left-2 z-10 w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-md text-lg ${isWinner ? 'bg-yellow-400 text-white' : 'bg-primary text-white'
                                        }`}>
                                        {index + 1}
                                    </div>

                                    {/* Image */}
                                    {nominee.image_url && (
                                        <div className="w-full aspect-square rounded-lg overflow-hidden bg-gray-100 mb-4">
                                            <img
                                                src={nominee.image_url}
                                                alt={nominee.name}
                                                className="w-full h-full object-cover"
                                                onError={(e) => e.target.style.display = 'none'}
                                            />
                                        </div>
                                    )}

                                    <h3 className="text-2xl font-semibold text-primary mb-2">
                                        {nominee.name}
                                    </h3>
                                    {nominee.description && (
                                        <p className="text-gray-600 text-sm mb-4">{nominee.description}</p>
                                    )}

                                    <div className="mt-auto">
                                        <div className="flex justify-between items-end mb-2">
                                            <div className="text-3xl font-bold text-text-dark">
                                                {nominee.vote_count}
                                            </div>
                                            <div className="text-lg font-medium text-gray-500">{percentage}%</div>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-3">
                                            <div
                                                className="bg-primary h-3 rounded-full transition-all duration-500"
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    <div className="text-center mt-8">
                        <p className="text-gray-600">Ընդհանուր ձայներ: {results.totalVotes}</p>
                    </div>
                </div>
            </div>
        )
    }

    if (!codeValidated) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-start justify-center px-4 pt-40">
                <Toaster position="top-center" />
                <div className="max-w-xl w-full fade-in">
                    <div className="text-center mb-8">
                        <img
                            src="/header-logo.png"
                            alt="Logo"
                            className="mx-auto w-64 sm:w-72 md:w-80 lg:w-96 h-auto"
                        />
                        <p className="text-gray-600 text-lg font-medium">
                            {session && session.status === 'closed'
                                ? 'Քվեարկությունը ավարտված է'
                                : 'Մուտքագրեք ձեր եզակի կոդը քվեարկելու համար'
                            }
                        </p>
                    </div>

                    {session && session.status === 'closed' ? (
                        <div className="card text-center">
                            <div className="space-y-4">
                                <div className="text-6xl">🏆</div>
                                <h2 className="text-2xl font-semibold text-text-dark">Քվեարկությունը փակ է</h2>
                                <p className="text-gray-600">
                                    Շնորհակալություն մասնակցության համար։<br />
                                    Արդյունքները շուտով կհրապարակվեն։
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="card">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Քվեարկության կոդ
                                    </label>
                                    <input
                                        type="text"
                                        value={code}
                                        onChange={(e) => {
                                            let value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '')

                                            // Remove existing dashes
                                            const clean = value.replace(/-/g, '')

                                            // Add dash after 3 characters automatically
                                            if (clean.length > 3) {
                                                value = clean.slice(0, 3) + '-' + clean.slice(3, 6)
                                            } else {
                                                value = clean
                                            }

                                            setCode(value)
                                        }}
                                        placeholder="XXX-XXX"
                                        className="input-field text-center text-lg tracking-wider font-semibold"
                                        maxLength={7}
                                        disabled={loading}
                                        onKeyPress={(e) => e.key === 'Enter' && validateCode()}
                                    />
                                </div>

                                <button
                                    onClick={validateCode}
                                    disabled={loading}
                                    className="btn btn-primary w-full text-lg font-semibold"
                                >
                                    {loading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <span className="spinner"></span>
                                            Ստուգում...
                                        </span>
                                    ) : (
                                        'Շարունակել'
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                </div>

                {/* Message Modal */}
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center animate-fade-in">
                            <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${modalType === 'success' ? 'bg-green-100' : 'bg-red-100'}`}>
                                {modalType === 'success' ? (
                                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                )}
                            </div>
                            <h3 className={`text-2xl font-semibold mb-2 ${modalType === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                {modalType === 'success' ? 'Հաջողություն!' : 'Սխալ'}
                            </h3>
                            <p className="text-gray-700 text-lg mb-6">{modalMessage}</p>
                            <button
                                onClick={() => setShowModal(false)}
                                className={`btn ${modalType === 'success' ? 'btn-primary' : 'bg-red-600 hover:bg-red-700 text-white'} w-full`}
                            >
                                Լավ
                            </button>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <Toaster position="top-center" />
            <div className="container-custom max-w-5xl">
                <div className="text-center fade-in">
                    <img
                        src="/header-logo.png"
                        alt="Logo"
                        className="mx-auto mb-6 w-64 sm:w-72 md:w-80 lg:w-96 h-auto"
                    />
                    <h1 className="text-5xl md:text-6xl text-primary mb-4 font-semibold">
                        {session?.title}
                    </h1>
                </div>

                <div className="flex flex-wrap justify-center gap-6 mb-8">
                    {nominees.map((nominee) => (
                        <div
                            key={nominee.id}
                            onClick={() => setSelectedNominee(nominee.id)}
                            className={`nominee-card w-full md:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] ${selectedNominee === nominee.id ? 'selected' : ''}`}
                        >
                            {nominee.image_url && (
                                <div className="w-full aspect-square rounded-lg overflow-hidden bg-gray-100 mb-4">
                                    <img
                                        src={nominee.image_url}
                                        alt={nominee.name}
                                        className="w-full h-full object-cover"
                                        onError={(e) => e.target.style.display = 'none'}
                                    />
                                </div>
                            )}
                            <h3 className="text-2xl font-semibold text-primary mb-2">
                                {nominee.name}
                            </h3>
                            {nominee.description && (
                                <p className="text-gray-600 text-sm">{nominee.description}</p>
                            )}
                            {selectedNominee === nominee.id && (
                                <div className="mt-4 flex items-center justify-center">
                                    <svg className="w-6 h-6 text-primary" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="text-center">
                    <button
                        onClick={submitVote}
                        disabled={voting}
                        className="btn btn-primary text-lg px-12"
                    >
                        {voting ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="spinner"></span>
                                Ուղարկում...
                            </span>
                        ) : (
                            'Քվեարկել'
                        )}
                    </button>
                </div>
            </div>

            {/* Message Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center animate-fade-in">
                        <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${modalType === 'success' ? 'bg-green-100' : 'bg-red-100'}`}>
                            {modalType === 'success' ? (
                                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            ) : (
                                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            )}
                        </div>
                        <h3 className={`text-2xl font-semibold mb-2 ${modalType === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                            {modalType === 'success' ? 'Հաջողություն!' : 'Սխալ'}
                        </h3>
                        <p className="text-gray-700 text-lg mb-6">{modalMessage}</p>
                        <button
                            onClick={() => setShowModal(false)}
                            className={`btn ${modalType === 'success' ? 'btn-primary' : 'bg-red-600 hover:bg-red-700 text-white'} w-full`}
                        >
                            Լավ
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
