import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BitcoinTransaction, TransactionFormData, TransactionResponse } from '@/lib/types';
import { BitcoinPriceService } from '@/lib/bitcoin-price-service';
import { withAuth } from '@/lib/auth-helpers';

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
  return withAuth(request, async (userId, user) => {
    const params = await context.params;
    const transactionId = parseInt(params.id);
    
    if (isNaN(transactionId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid transaction ID',
        message: 'Transaction ID must be a number'
      } as TransactionResponse, { status: 400 });
    }

    const transaction = await prisma.bitcoinTransaction.findFirst({
      where: { 
        id: transactionId,
        userId: userId
      }
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
      tags: (transaction as any).tags || '',
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
  });
}

// PUT - Update transaction by ID
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (userId, user) => {
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
    const isTransfer = formData.type === 'TRANSFER';
    
    if (!formData.type || !formData.btc_amount || !formData.transaction_date) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields',
        message: 'Type, BTC amount, and date are required'
      } as TransactionResponse, { status: 400 });
    }
    
    // For non-TRANSFER transactions, price is required
    if (!isTransfer && !formData.price_per_btc) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields',
        message: 'Price is required for BUY/SELL transactions'
      } as TransactionResponse, { status: 400 });
    }
    
    // For TRANSFER transactions, transfer_type is required
    if (isTransfer && !formData.transfer_type) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields',
        message: 'Transfer type is required for TRANSFER transactions'
      } as TransactionResponse, { status: 400 });
    }

    // Convert string values to numbers
    const btcAmount = parseFloat(formData.btc_amount);
    // For external transfers (TRANSFER_IN/OUT), allow reference price; internal transfers have no price
    const isExternalTransfer = isTransfer && (formData.transfer_type === 'TRANSFER_IN' || formData.transfer_type === 'TRANSFER_OUT');
    const pricePerBtc = isTransfer && !isExternalTransfer ? 0 : parseFloat(formData.price_per_btc || '0');
    const fees = parseFloat(formData.fees || '0');

    // Allow zero price for mining/gifts/airdrops/transfers (but not negative)
    if (isNaN(btcAmount) || isNaN(pricePerBtc) || btcAmount <= 0 || pricePerBtc < 0) {
      return NextResponse.json({
        success: false,
        error: 'Invalid numeric values',
        message: 'BTC amount must be positive, price cannot be negative'
      } as TransactionResponse, { status: 400 });
    }

    // Calculate original total amount
    const originalTotalAmount = btcAmount * pricePerBtc;
    
    // Determine fees currency - for TRANSFER, always use BTC (network fees are paid in BTC)
    const feesCurrency = isTransfer ? 'BTC' : formData.currency;

    // Update transaction using Prisma - only store original data for this user
    const updatedTransaction = await prisma.bitcoinTransaction.update({
      where: { 
        id: transactionId,
        userId: userId
      },
      data: {
        type: formData.type,
        btcAmount: btcAmount,
        originalPricePerBtc: pricePerBtc,
        originalCurrency: formData.currency,
        originalTotalAmount: originalTotalAmount,
        fees: fees,
        feesCurrency: feesCurrency,
        transactionDate: new Date(formData.transaction_date),
        notes: formData.notes || '',
        tags: formData.tags || null,
        transferType: isTransfer ? formData.transfer_type : null,
        destinationAddress: isTransfer ? (formData.destination_address || null) : null
        // updatedAt is automatically handled by Prisma
      } as any
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
      type: updatedTransaction.type as 'BUY' | 'SELL' | 'TRANSFER',
      transaction_date: updatedTransaction.transactionDate.toISOString().split('T')[0],
      btc_amount: updatedTransaction.btcAmount,
      original_price_per_btc: updatedTransaction.originalPricePerBtc,
      original_currency: updatedTransaction.originalCurrency,
      original_total_amount: updatedTransaction.originalTotalAmount,
      fees_currency: updatedTransaction.feesCurrency,
      notes: updatedTransaction.notes || '',
      tags: (updatedTransaction as any).tags || '',
      transfer_type: (updatedTransaction as any).transferType || null,
      destination_address: (updatedTransaction as any).destinationAddress || null,
      created_at: updatedTransaction.createdAt,
      updated_at: updatedTransaction.updatedAt
    };

    const response: TransactionResponse = {
      success: true,
      data: formattedUpdatedTransaction as any,
      message: 'Transaction updated successfully'
    };

    return NextResponse.json(response);
  });
}

// DELETE - Delete transaction by ID
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (userId, user) => {
    const params = await context.params;
    const transactionId = parseInt(params.id);
    
    if (isNaN(transactionId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid transaction ID',
        message: 'Transaction ID must be a number'
      } as TransactionResponse, { status: 400 });
    }

    // First check if transaction exists and delete it using Prisma - only for this user
    try {
      await prisma.bitcoinTransaction.delete({
        where: { 
          id: transactionId,
          userId: userId
        }
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
  });
} 