import { useState, useEffect, useRef } from 'react'

export default function DropdownMenu({ trigger, items, align = 'right' }) {
    const [isOpen, setIsOpen] = useState(false)
    const [position, setPosition] = useState({ top: 0, left: 0, right: 0 })
    const dropdownRef = useRef(null)
    const triggerRef = useRef(null)

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }

        function handleScroll() {
            setIsOpen(false)
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            window.addEventListener('scroll', handleScroll, true) // true = capture phase, catches all scrolls
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            window.removeEventListener('scroll', handleScroll, true)
        }
    }, [isOpen])

    const handleToggle = () => {
        if (!isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect()
            setPosition({
                top: rect.bottom + 4,
                left: align === 'left' ? rect.left : 'auto',
                right: align === 'right' ? window.innerWidth - rect.right : 'auto'
            })
        }
        setIsOpen(!isOpen)
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <div ref={triggerRef} onClick={handleToggle}>
                {trigger}
            </div>

            {isOpen && (
                <div
                    className="dropdown-menu"
                    style={{
                        position: 'fixed',
                        top: `${position.top}px`,
                        left: position.left !== 'auto' ? `${position.left}px` : 'auto',
                        right: position.right !== 'auto' ? `${position.right}px` : 'auto',
                        zIndex: 9999
                    }}
                >
                    {items.map((item, index) => (
                        <button
                            key={index}
                            onClick={() => {
                                item.onClick()
                                setIsOpen(false)
                            }}
                            className={`dropdown-item w-full text-left ${item.danger ? 'danger' : ''}`}
                            disabled={item.disabled}
                        >
                            {item.icon && <span className="text-lg">{item.icon}</span>}
                            <span>{item.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
