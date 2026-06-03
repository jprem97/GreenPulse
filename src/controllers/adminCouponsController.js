export const createCoupon = async (
  req,
  res
) => {

  try {

    const {

      company,

      product,

      code,

      pointsRequired,

      expiryDate

    } = req.body;

    const coupon =
      await Coupon.create({

        company,

        product,

        code,

        pointsRequired,

        expiryDate
      });

    res.status(201).json({

      success: true,

      coupon
    });

  } catch (error) {

    res.status(500).json({

      success: false,

      message: error.message
    });
  }
};

export const deactivateCoupon =
async (req, res) => {

  try {

    const coupon =
      await Coupon.findByIdAndUpdate(

        req.params.id,

        {
          status: "EXPIRED"
        },

        {
          new: true
        }
      );

    if (!coupon) {

      return res.status(404).json({

        message:
          "Coupon not found"
      });
    }

    res.status(200).json({

      success: true,

      coupon
    });

  } catch (error) {

    res.status(500).json({

      success: false,

      message: error.message
    });
  }
};