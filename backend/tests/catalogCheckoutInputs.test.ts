import assert from "node:assert/strict";
import { test } from "node:test";
import { getProvince, provinces, resolveAddressLocation } from "../src/services/addressLocations.js";
import { productAudiences } from "../src/services/catalogAudience.js";
import { estimateAdultSize } from "../src/services/sizeGuide.js";

test("địa chỉ dùng tỉnh và phường/xã cùng địa bàn", () => {
  assert.equal(provinces.length, 34);
  const province = getProvince(1);
  const ward = province.wards[0]!;
  assert.deepEqual(resolveAddressLocation("01", String(ward.code)), {
    province: province.name, province_code: 1, ward: ward.name, ward_code: ward.code, district: "",
  });
  assert.throws(() => resolveAddressLocation(79, ward.code), /phải thuộc tỉnh/);
  assert.throws(() => resolveAddressLocation("khác", ward.code), /tỉnh hoặc thành phố hợp lệ/);
});

test("Unisex là danh mục người lớn; sản phẩm em bé hiển thị cả trong nhóm trẻ em", () => {
  assert.deepEqual(productAudiences(" Unisex "), ["nam", "nu"]);
  assert.deepEqual(productAudiences("Em bé"), ["em-be", "tre-em"]);
  assert.deepEqual(productAudiences(undefined), []);
});

test("ước lượng size thay đổi theo phom và giới hạn số đo được hỗ trợ", () => {
  assert.equal(estimateAdultSize(170, 65, "Regular"), "M");
  assert.equal(estimateAdultSize(170, 65, "Oversize"), "L");
  assert.equal(estimateAdultSize(110, 25, "Regular"), undefined);
});
