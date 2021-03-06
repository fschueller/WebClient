angular.module('proton.payment')
    .factory('paymentModel', (Payment, networkActivityTracker, gettextCatalog, notification) => {

        let CACHE = {};
        const I18N = {
            SUBSCRIBE_ERROR: gettextCatalog.getString('Error subscribing', null, 'Error'),
            COUPON_INVALID: gettextCatalog.getString('Invalid coupon', null, 'Error'),
            COUPON_SUCCESS: gettextCatalog.getString('Coupon accepted', null, 'Coupon request')
        };

        const get = (key) => CACHE[key];
        const set = (key, value) => (CACHE[key] = value);
        const clear = (key) => (key ? CACHE[key] = null : CACHE = {});

        const loadStatus = () => {
            return Payment.status()
                .then(({ data = {} }) => data)
                .then((data) => set('status', data))
                .catch(({ data = {} } = {}) => {
                    throw Error(data.Error);
                });
        };


        const loadMethods = ({ subuser } = {}) => {
            if (subuser) {
                return Promise.resolve([]);
            }
            return Payment.methods()
                .then(({ data = {} }) => data.PaymentMethods)
                .then((data) => set('methods', data))
                .catch(({ data = {} } = {}) => {
                    throw Error(data.Error);
                });
        };

        const load = (type, cb) => (refresh, data) => {
            refresh && clear(type);
            if (get(type)) {
                return Promise.resolve(get(type));
            }
            return cb(data);
        };

        const getStatus = load('status', loadStatus);
        const getMethods = load('methods', loadMethods);

        const canPay = () => {
            const { Stripe, Paymentwall } = get('status') || {};
            return Stripe || Paymentwall;
        };

        function subscribe(config) {
            return Payment.subscribe(config)
                .then(({ data = {} } = {}) => {
                    if (data.Code === 1000) {
                        return data;
                    }
                })
                .catch(({ data = {} } = {}) => {
                    throw Error(data.Error || I18N.SUBSCRIBE_ERROR);
                });
        }

        function addCoupon(opt) {
            const promise = Payment.valid(opt)
                .then(({ data = {} } = {}) => {
                    if (data.CouponDiscount === 0) {
                        throw new Error(I18N.COUPON_INVALID);
                    }

                    if (data.Code === 1000) {
                        return data;
                    }
                })
                .then((data) => {
                    notification.success(I18N.COUPON_SUCCESS);
                    return data;
                })
                .catch((error) => {
                    const { data = {} } = error;
                    throw Error(data.Error || error);
                });

            networkActivityTracker.track(promise);

            return promise;
        }

        return { getStatus, getMethods, get, canPay, subscribe, addCoupon };
    });
