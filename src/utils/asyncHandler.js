// const asyncHandler = () =>{}
// const asyncHandler = (funtion) => {
//   () => {};
// };
// const asyncHandler = (funtion) => () => {};

// This is using try catch
const asyncHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    res.status(err.code || 500).json({
      success: false,
      message: err.message,
    });
  }
};

//This is using Promises
// const asyncHandler = (fn) => (req, res, next) => {
//   Promise.resolve(fn(req, res, next)).catch((err) => next(err));
// };
export { asyncHandler };
