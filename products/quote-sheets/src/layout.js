// Cell addresses shared by the generator and the tests.
export const MAX_SERVICES = 20;           // rows available on the Rates sheet
export const SVC_FIRST = 13;
export const SVC_LAST = SVC_FIRST + MAX_SERVICES - 1; // 32
export const LINE_FIRST = 9;
export const LINE_LAST = 20;              // 12 quote lines
export const SETTING_CELLS = {
  labourCostPerHour: 'B4', travelCostPerMile: 'B5', taxRate: 'B6',
  travelChargePerMile: 'B7', minimumCharge: 'B8', targetMargin: 'B9',
};
export const QUOTE = { customer: 'B3', date: 'B4', miles: 'B5', discount: 'B24',
  subtotal: 'E22', travel: 'E23', discountAmt: 'E24', topUp: 'E25', preTax: 'E26', tax: 'E27', total: 'E28' };
export const PROFIT = { hours: 'B22', materials: 'C22', revenue: 'B24', labour: 'B25', mats: 'B26',
  travel: 'B27', cost: 'B28', profit: 'B29', margin: 'B30', perHour: 'B31', verdict: 'B32' };
