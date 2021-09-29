# 一张图彻底搞懂 MySQL 的锁机制

![img](/Users/mbpzy/images/Zu4vlv7L2S.png!large)

总结：

表锁：myisam 

行锁：InnoDB

两者都有共享锁（S锁）与排他锁（X锁），行锁多个意向锁（IS/IX）