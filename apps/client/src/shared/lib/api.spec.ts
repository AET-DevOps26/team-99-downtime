import { ApiError, apiErrorInfo } from './api';

describe('apiErrorInfo', () => {
  it('reads Spring-style error codes and fields', () => {
    expect(
      apiErrorInfo(
        new ApiError(400, {
          error: 'VALIDATION_ERROR',
          fields: { name: 'Required' },
        })
      )
    ).toEqual({
      status: 400,
      code: 'VALIDATION_ERROR',
      fields: { name: 'Required' },
    });
  });

  it('reads FastAPI string details as error codes', () => {
    expect(apiErrorInfo(new ApiError(502, { detail: 'LLM_UNAVAILABLE' }))).toEqual({
      status: 502,
      code: 'LLM_UNAVAILABLE',
      fields: undefined,
    });
  });

  it('does not treat FastAPI validation details as an error code', () => {
    expect(
      apiErrorInfo(
        new ApiError(422, {
          detail: [{ loc: ['body', 'weekStart'], msg: 'Field required', type: 'missing' }],
        })
      )
    ).toEqual({ status: 422, code: undefined, fields: undefined });
  });
});
