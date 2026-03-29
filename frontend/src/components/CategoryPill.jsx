export default function CategoryPill({ category }) {
  const colors = {
    Food: 'bg-amber-500/20 text-amber-400',
    Transport: 'bg-blue-500/20 text-blue-400',
    Shopping: 'bg-pink-500/20 text-pink-400',
    Bills: 'bg-green-500/20 text-green-400',
    Other: 'bg-gray-500/20 text-gray-400',
  }

  return (
    <span className={`inline-block px-2.5 py-1 rounded text-xs font-medium ${colors[category] || colors.Other}`}>
      {category}
    </span>
  )
}
