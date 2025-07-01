import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BitcoinTransaction, TransactionFormData, TransactionResponse } from '@/lib/types';
import { BitcoinPriceService } from '@/lib/bitcoin-price-service';

// Helper function to get exchange rate
const getExchangeRate = async (fromCurrency: string, toCurrency: string = 'USD'): Promise<number> => {
  if (fromCurrency === toCurrency) return 1.0;
  
  // TODO: Implement real exchange rate fetching
  const rates: { [key: string]: number } = {
    'EUR': 1.05,
    'PLN': 0.25,
    'GBP': 1.27,
    'USD': 1.0
  };
  
  return rates[fromCurrency] || 1.0;
};

// GET - Fetch single transaction by ID
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const transactionId = parseInt(params.id);
    
    if (isNaN(transactionId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid transaction ID',
        message: 'Transaction ID must be a number'
      } as TransactionResponse, { status: 400 });
    }

    const transaction = await prisma.bitcoinTransaction.findUnique({
      where: { id: transactionId }
    });

    // Format the transaction to match expected format
    const formattedTransaction = transaction ? {
      ...transaction,
      type: transaction.type as 'BUY' | 'SELL',
      transaction_date: transaction.transactionDate.toISOString().split('T')[0],
      btc_amount: transaction.btcAmount,
      original_price_per_btc: transaction.originalPricePerBtc,
      original_currency: transaction.originalCurrency,
      original_total_amount: transaction.originalTotalAmount,
      fees_currency: transaction.feesCurrency,
      notes: transaction.notes || '',
      created_at: transaction.createdAt,
      updated_at: transaction.updatedAt
    } : null;

    if (!formattedTransaction) {
      return NextResponse.json({
        success: false,
        error: 'Transaction not found',
        message: `Transaction with ID ${transactionId} does not exist`
      } as TransactionResponse, { status: 404 });
    }

    const response: TransactionResponse = {
      success: true,
      data: formattedTransaction as any,
      message: 'Transaction retrieved successfully'
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching transaction:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch transaction',
      message: 'An error occurred while retrieving the transaction'
    } as TransactionResponse, { status: 500 });
  }
}

// PUT - Update transaction by ID
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const transactionId = parseInt(params.id);
    
    if (isNaN(transactionId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid transaction ID',
        message: 'Transaction ID must be a number'
      } as TransactionResponse, { status: 400 });
    }

    const formData: TransactionFormData = await request.json();

    // Validate required fields
    if (!formData.type || !formData.btc_amount || !formData.price_per_btc || !formData.transaction_date) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields',
        message: 'Type, BTC amount, price, and date are required'
      } as TransactionResponse, { status: 400 });
    }

    // Convert string values to numbers
    const btcAmount = parseFloat(formData.btc_amount);
    const pricePerBtc = parseFloat(formData.price_per_btc);
    const fees = parseFloat(formData.fees || '0');

    if (isNaN(btcAmount) || isNaN(pricePerBtc) || btcAmount <= 0 || pricePerBtc <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Invalid numeric values',
        message: 'BTC amount and price must be positive numbers'
      } as TransactionResponse, { status: 400 });
    }

    // Calculate original total amount
    const originalTotalAmount = btcAmount * pricePerBtc;

    // Update transaction using Prisma - only store original data
    const updatedTransaction = await prisma.bitcoinTransaction.update({
      where: { id: transactionId },
      data: {
        type: formData.type,
        btcAmount: btcAmount,
        originalPricePerBtc: pricePerBtc,
        originalCurrency: formData.currency,
        originalTotalAmount: originalTotalAmount,
        fees: fees,
        feesCurrency: formData.currency, // fees currency same as transaction currency
        transactionDate: new Date(formData.transaction_date),
        notes: formData.notes || ''
        // updatedAt is automatically handled by Prisma
      }
    });

    // Recalculate portfolio after updating transaction
    try {
      await BitcoinPriceService.calculateAndStorePortfolioSummary();
    } catch (portfolioError) {
      console.error('Error updating portfolio after transaction update:', portfolioError);
      // Don't fail the transaction update if portfolio update fails
    }

    // Format the updated transaction to match expected format
    const formattedUpdatedTransaction = {
      ...updatedTransaction,
      type: updatedTransaction.type as 'BUY' | 'SELL',
      transaction_date: updatedTransaction.transactionDate.toISOString().split('T')[0],
      btc_amount: updatedTransaction.btcAmount,
      original_price_per_btc: updatedTransaction.originalPricePerBtc,
      original_currency: updatedTransaction.originalCurrency,
      original_total_amount: updatedTransaction.originalTotalAmount,
      fees_currency: updatedTransaction.feesCurrency,
      notes: updatedTransaction.notes || '',
      created_at: updatedTransaction.createdAt,
      updated_at: updatedTransaction.updatedAt
    };

    const response: TransactionResponse = {
      success: true,
      data: formattedUpdatedTransaction as any,
      message: 'Transaction updated successfully'
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error updating transaction:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update transaction',
      message: 'An error occurred while updating the transaction'
    } as TransactionResponse, { status: 500 });
  }
}

// DELETE - Delete transaction by ID
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const transactionId = parseInt(params.id);
    
    if (isNaN(transactionId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid transaction ID',
        message: 'Transaction ID must be a number'
      } as TransactionResponse, { status: 400 });
    }

    // First check if transaction exists and delete it using Prisma
    try {
      await prisma.bitcoinTransaction.delete({
        where: { id: transactionId }
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        // Prisma error code for "Record not found"
        return NextResponse.json({
          success: false,
          error: 'Transaction not found',
          message: `Transaction with ID ${transactionId} does not exist`
        } as TransactionResponse, { status: 404 });
      }
      throw error; // Re-throw other errors to be caught by outer try-catch
    }

    // Recalculate portfolio after deleting transaction
    try {
      await BitcoinPriceService.calculateAndStorePortfolioSummary();
    } catch (portfolioError) {
      console.error('Error updating portfolio after transaction deletion:', portfolioError);
      // Don't fail the transaction deletion if portfolio update fails
    }

    const response: TransactionResponse = {
      success: true,
      message: 'Transaction deleted successfully'
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to delete transaction',
      message: 'An error occurred while deleting the transaction'
    } as TransactionResponse, { status: 500 });
  }
} 