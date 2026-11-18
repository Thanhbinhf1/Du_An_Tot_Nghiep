import { AppError } from "../middlewares/AppError.js";

export const getBankConfig = () => {
  const bankName = process.env.BANK_NAME;
  const accountNumber = process.env.BANK_ACCOUNT_NUMBER;
  const accountName = process.env.BANK_ACCOUNT_NAME;

  if (!bankName || !accountNumber || !accountName) {
    throw new AppError("Chưa cấu hình thông tin ngân hàng", 500);
  }

  return {
    bank_name: bankName,
    account_number: accountNumber,
    account_name: accountName,
  };
};
