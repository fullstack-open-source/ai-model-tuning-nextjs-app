/**
 * Country Code Selector Component
 * Dropdown for selecting country codes for phone numbers
 */

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@lib/utils"

export interface Country {
  code: string
  name: string
  dialCode: string
  flag: string
}

// Common countries list
const COUNTRIES: Country[] = [
  { code: "NP", name: "Nepal", dialCode: "+977", flag: "🇳🇵" },
  { code: "US", name: "United States", dialCode: "+1", flag: "🇺🇸" },
  { code: "IN", name: "India", dialCode: "+91", flag: "🇮🇳" },
  { code: "GB", name: "United Kingdom", dialCode: "+44", flag: "🇬🇧" },
  { code: "CA", name: "Canada", dialCode: "+1", flag: "🇨🇦" },
  { code: "AU", name: "Australia", dialCode: "+61", flag: "🇦🇺" },
  { code: "DE", name: "Germany", dialCode: "+49", flag: "🇩🇪" },
  { code: "FR", name: "France", dialCode: "+33", flag: "🇫🇷" },
  { code: "JP", name: "Japan", dialCode: "+81", flag: "🇯🇵" },
  { code: "CN", name: "China", dialCode: "+86", flag: "🇨🇳" },
  { code: "BR", name: "Brazil", dialCode: "+55", flag: "🇧🇷" },
  { code: "MX", name: "Mexico", dialCode: "+52", flag: "🇲🇽" },
  { code: "RU", name: "Russia", dialCode: "+7", flag: "🇷🇺" },
  { code: "KR", name: "South Korea", dialCode: "+82", flag: "🇰🇷" },
  { code: "IT", name: "Italy", dialCode: "+39", flag: "🇮🇹" },
  { code: "ES", name: "Spain", dialCode: "+34", flag: "🇪🇸" },
  { code: "NL", name: "Netherlands", dialCode: "+31", flag: "🇳🇱" },
  { code: "SE", name: "Sweden", dialCode: "+46", flag: "🇸🇪" },
  { code: "NO", name: "Norway", dialCode: "+47", flag: "🇳🇴" },
  { code: "DK", name: "Denmark", dialCode: "+45", flag: "🇩🇰" },
]

export interface CountrySelectorProps {
  value: string
  onChange: (dialCode: string) => void
  className?: string
}

export function CountrySelector({ value, onChange, className }: CountrySelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const selectedCountry = COUNTRIES.find(c => c.dialCode === value) || COUNTRIES[0]

  React.useEffect(() => {
    if (!value) {
      onChange(COUNTRIES[0].dialCode)
    }
  }, [value, onChange])

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-12 px-4 rounded-lg border border-gray-300 bg-white flex items-center justify-between hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{selectedCountry.flag}</span>
          <span className="text-sm font-medium text-gray-700">
            {selectedCountry.name} ({selectedCountry.dialCode})
          </span>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-gray-500 transition-transform", isOpen && "transform rotate-180")} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
            {COUNTRIES.map((country) => (
              <button
                key={country.code}
                type="button"
                onClick={() => {
                  onChange(country.dialCode)
                  setIsOpen(false)
                }}
                className={cn(
                  "w-full px-4 py-2 flex items-center gap-2 hover:bg-gray-50 text-left",
                  selectedCountry.code === country.code && "bg-blue-50"
                )}
              >
                <span className="text-lg">{country.flag}</span>
                <span className="text-sm font-medium text-gray-700">{country.name}</span>
                <span className="ml-auto text-sm text-gray-500">{country.dialCode}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

