export default function Pagination({
    currentPage,
    totalItems,
    itemsPerPage,
    onPageChange,
    onItemsPerPageChange
}) {
    const totalPages = Math.ceil(totalItems / itemsPerPage)
    const startItem = (currentPage - 1) * itemsPerPage + 1
    const endItem = Math.min(currentPage * itemsPerPage, totalItems)

    const pageOptions = [10, 15, 25, 50]

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
            {/* Items per page selector */}
            <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 whitespace-nowrap">Ցույց տալ էջում:</span>
                <select
                    value={itemsPerPage}
                    onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
                    className="input-field py-1 px-2 text-sm w-20"
                >
                    {pageOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
                <span className="text-sm text-gray-600">տող</span>
            </div>

            {/* Page info */}
            <div className="pagination-info">
                {totalItems > 0 ? (
                    <>
                        Ցուցադրվում է {startItem}-{endItem} / {totalItems}
                    </>
                ) : (
                    'Տվյալներ չկան'
                )}
            </div>

            {/* Pagination controls */}
            <div className="pagination">
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="pagination-button"
                >
                    ← Նախորդ
                </button>

                <span className="text-sm text-gray-700">
                    Էջ {currentPage} / {totalPages || 1}
                </span>

                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="pagination-button"
                >
                    Հաջորդ →
                </button>
            </div>
        </div>
    )
}
