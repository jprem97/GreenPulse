import Coupon from "../models/Coupons.js";

export const getCoupons = async (req, res) => {

  try {

    const coupons = await Coupon.find({

      status: "ACTIVE",

      $or: [

        { expiryDate: { $exists: false } },

        { expiryDate: { $gt: new Date() } }
      ]
    });

    res.status(200).json({

      success: true,

      coupons
    });

  } catch (error) {

    res.status(500).json({

      success: false,

      message: error.message
    });
  }
};

export const toggleSaveCoupon = async (req, res) => {

  try {

    const coupon = await Coupon.findById(
      req.params.id
    );

    if (!coupon) {

      return res.status(404).json({

        message: "Coupon not found"
      });
    }

    const userId =
      req.user._id.toString();

    const alreadySaved =
      coupon.savedBy.some(

        id => id.toString() === userId
      );

    if (alreadySaved) {

      coupon.savedBy =
        coupon.savedBy.filter(

          id =>
            id.toString() !== userId
        );

      await coupon.save();

      return res.json({

        success: true,

        message:
          "Coupon removed from saved"
      });
    }

    coupon.savedBy.push(userId);

    await coupon.save();

    res.json({

      success: true,

      message:
        "Coupon saved"
    });

  } catch (error) {

    res.status(500).json({

      success: false,

      message: error.message
    });
  }
};

export const redeemCoupon = async (req, res) => {

  try {

    const coupon = await Coupon.findById(
      req.params.id
    );

    if (!coupon) {

      return res.status(404).json({

        message: "Coupon not found"
      });
    }

    if (coupon.status !== "ACTIVE") {

      return res.status(400).json({

        message:
          "Coupon not active"
      });
    }

    if (
      coupon.expiryDate &&
      coupon.expiryDate < new Date()
    ) {

      return res.status(400).json({

        message:
          "Coupon expired"
      });
    }

    const alreadyRedeemed =
      coupon.redeemedBy.some(

        id =>
          id.toString() ===
          req.user._id.toString()
      );

    if (alreadyRedeemed) {

      return res.status(400).json({

        message:
          "Already redeemed"
      });
    }

    const user = await User.findById(
      req.user._id
    );

    if (
      user.ecoPoints <
      coupon.pointsRequired
    ) {

      return res.status(400).json({

        message:
          "Not enough points"
      });
    }

    user.ecoPoints -=
      coupon.pointsRequired;

    coupon.redeemedBy.push(
      user._id
    );

    await user.save();

    await coupon.save();

    res.status(200).json({

      success: true,

      message:
        "Coupon redeemed",

      couponCode:
        coupon.code
    });

  } catch (error) {

    res.status(500).json({

      success: false,

      message: error.message
    });
  }
};

export const myCoupons = async (
  req,
  res
) => {

  try {

    const userId = req.user._id;

    const savedCoupons =
      await Coupon.find({

        savedBy: userId
      });

    const redeemedCoupons =
      await Coupon.find({

        redeemedBy: userId
      });

    res.status(200).json({

      success: true,

      savedCoupons,

      redeemedCoupons
    });

  } catch (error) {

    res.status(500).json({

      success: false,

      message: error.message
    });
  }
};