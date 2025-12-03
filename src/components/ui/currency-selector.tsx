"use client"

import * as React from "react"
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface Currency {
  code: string
  name: string
  symbol: string
}

interface CurrencySelectorProps {
  value: string
  currencies: Currency[]
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  className?: string
  id?: string
}

export function CurrencySelector({
  value,
  currencies,
  onChange,
  placeholder = "Select currency...",
  searchPlaceholder = "Search currency...",
  className,
  id,
}: CurrencySelectorProps) {
  const [open, setOpen] = React.useState(false)

  const selectedCurrency = currencies.find((currency) => currency.code === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          {selectedCurrency ? (
            <span className="flex items-center gap-2">
              <span className="font-semibold">{selectedCurrency.symbol} {selectedCurrency.code}</span>
              <span className="text-muted-foreground">- {selectedCurrency.name}</span>
            </span>
          ) : (
            placeholder
          )}
          <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>No currency found.</CommandEmpty>
            <CommandGroup>
              {currencies.map((currency) => (
                <CommandItem
                  key={currency.code}
                  value={`${currency.code} ${currency.name} ${currency.symbol}`}
                  onSelect={() => {
                    onChange(currency.code)
                    setOpen(false)
                  }}
                >
                  <CheckIcon
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === currency.code ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{currency.symbol} {currency.code}</span>
                    <span className="text-muted-foreground text-sm">- {currency.name}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

