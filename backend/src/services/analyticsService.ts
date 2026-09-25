import { OrderRecord, ProductRecord, AnalyticsDTO } from '../types/index.js';

export const analyticsService = {
  /**
   * Calculates comprehensive analytics from real database products and orders.
   * Never returns hard-coded percentages. Missing time periods are padded with zero.
   */
  calculateAnalytics(
    orders: OrderRecord[],
    products: ProductRecord[],
    timeframe: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'monthly'
  ): AnalyticsDTO {
    // Only count non-cancelled orders toward revenue and completed metrics
    const validOrders = orders.filter((o) => o.status !== 'cancelled');

    const totalSales = validOrders.reduce((sum, o) => sum + Number(o.total_price || 0), 0);
    const totalOrders = orders.length;

    const uniqueCustomerSet = new Set(
      validOrders.map((o) => o.customer_name?.trim().toLowerCase()).filter(Boolean)
    );
    const uniqueCustomers = uniqueCustomerSet.size;

    const totalProducts = products.length;
    const totalStock = products.reduce((sum, p) => sum + Number(p.stock || 0), 0);
    const lowStockCount = products.filter((p) => Number(p.stock || 0) <= 5).length;

    const chart = this.generateSalesChart(validOrders, timeframe);

    return {
      totalSales: Math.round(totalSales * 100) / 100,
      totalOrders,
      uniqueCustomers,
      totalProducts,
      totalStock,
      lowStockCount,
      chart,
      timeframe,
      lastUpdated: new Date().toISOString(),
    };
  },

  /**
   * Generates chart labels and aggregate values grouped by time period.
   */
  generateSalesChart(
    orders: OrderRecord[],
    timeframe: 'daily' | 'weekly' | 'monthly' | 'yearly'
  ): { labels: string[]; values: number[] } {
    const now = new Date();

    if (timeframe === 'daily') {
      // Past 7 days
      const days: string[] = [];
      const dayValues: Record<string, number> = {};

      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const dateKey = d.toISOString().split('T')[0]; // YYYY-MM-DD
        const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
        days.push(label);
        dayValues[dateKey] = 0;
      }

      for (const order of orders) {
        const orderDate = (order.order_date || '').split('T')[0];
        if (dayValues[orderDate] !== undefined) {
          dayValues[orderDate] += Number(order.total_price || 0);
        }
      }

      return {
        labels: days,
        values: Object.values(dayValues).map((v) => Math.round(v * 100) / 100),
      };
    }

    if (timeframe === 'weekly') {
      // Past 4 weeks
      const weekLabels: string[] = [];
      const weekValues: number[] = [0, 0, 0, 0];

      for (let i = 3; i >= 0; i--) {
        weekLabels.push(`Week ${4 - i}`);
      }

      for (const order of orders) {
        const orderTime = new Date(order.order_date || now).getTime();
        const diffDays = Math.floor((now.getTime() - orderTime) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays < 28) {
          const weekIndex = 3 - Math.floor(diffDays / 7);
          if (weekIndex >= 0 && weekIndex < 4) {
            weekValues[weekIndex] += Number(order.total_price || 0);
          }
        }
      }

      return {
        labels: weekLabels,
        values: weekValues.map((v) => Math.round(v * 100) / 100),
      };
    }

    if (timeframe === 'yearly') {
      // Past 5 years
      const currentYear = now.getFullYear();
      const years: string[] = [];
      const yearValues: Record<number, number> = {};

      for (let y = currentYear - 4; y <= currentYear; y++) {
        years.push(String(y));
        yearValues[y] = 0;
      }

      for (const order of orders) {
        const orderYear = new Date(order.order_date || now).getFullYear();
        if (yearValues[orderYear] !== undefined) {
          yearValues[orderYear] += Number(order.total_price || 0);
        }
      }

      return {
        labels: years,
        values: Object.values(yearValues).map((v) => Math.round(v * 100) / 100),
      };
    }

    // Default: monthly (past 6 months)
    const monthLabels: string[] = [];
    const monthKeys: string[] = [];
    const monthValues: Record<string, number> = {};

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      monthKeys.push(key);
      monthLabels.push(label);
      monthValues[key] = 0;
    }

    for (const order of orders) {
      const d = new Date(order.order_date || now);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthValues[key] !== undefined) {
        monthValues[key] += Number(order.total_price || 0);
      }
    }

    return {
      labels: monthLabels,
      values: monthKeys.map((k) => Math.round((monthValues[k] || 0) * 100) / 100),
    };
  },
};
