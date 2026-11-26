import assert from "node:assert/strict";
import { test } from "node:test";
import { getProvince, provinces, resolveAddressLocation } from "../src/services/addressLocations.js";
import { productAudiences } from "../src/services/catalogAudience.js";
import { matchSizeChart, readChartRow, readMeasurements } from "../src/services/sizeGuide.js";

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

test("tư vấn size khớp bảng đã cấu hình, số đo và phom dáng", () => {
  const medium = readChartRow({ size: "M", fit_type: "Regular", min_height: 164, max_height: 176,
    min_weight: 56, max_weight: 72, min_chest: 80, max_chest: 100, garment: { length: 66 } });
  const large = readChartRow({ ...medium, size: "L", min_height: 168, max_height: 182 });
  assert.deepEqual(matchSizeChart([large, medium], "Regular", { height: 170, weight: 65 }).map((row) => row.size), ["M", "L"]);
  assert.deepEqual(matchSizeChart([medium], "Oversize", { height: 170, weight: 65 }), []);
  assert.deepEqual(matchSizeChart([medium], "Regular", { height: 170, weight: 65, chest: 101 }), []);
  assert.deepEqual(matchSizeChart([medium], "Regular", { height: 170 }), []);
  assert.deepEqual(matchSizeChart([], "Regular", { height: 170, weight: 65 }), []);
  assert.throws(() => readMeasurements({ height: "170" }, false), /Chiều cao/);
  assert.throws(() => readMeasurements({ height: "0xff" }, true), /Chiều cao/);
  assert.throws(() => readChartRow({ size: "M", min_chest: 90, max_chest: 80 }), /vòng ngực/);
  assert.throws(() => readChartRow({ size: "M", garment: { length: -10 } }), /trang phục/);
});
