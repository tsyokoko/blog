Maven中依赖冲突与循环依赖是开发过程中比较令人头疼的问题。

## 依赖冲突

首先介绍下Maven中依赖管理的策略。

依赖传递：如果A依赖B，B依赖C，那么引入A，意味着B和C都会被引入。

最近依赖策略：如果一个项目依赖相同的groupId、artifactId的多个版本，那么在依赖树（mvn dependency:tree）中离项目最近的那个版本将会被使用。

具体如下：

1. 从当前项目出发，对于同一依赖，优先使用路径最短的那个，无论版本号高低。

![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/b43c70f630e5c4f278e8eec88abdc278.webp)

1. 同级别的引用，若pom.xml直接引用了两个不同版本的同一个依赖，maven会使用后解析的依赖版本。

![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/3c03d8bffe5028c6f8121e08ab57ba72.webp)

1. 若两个不同版本的同一依赖都不是直接在pom.xml下引入，而是间接引入。那么哪个依赖先被引用，就使用哪个版本。

![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/b7f5cdb840bcc431f47a923f67c80d02.webp)

### 解决依赖冲突

1. 使用`<dependencyManagement>`用于子模块的版本一致性，可以在parent工程里统一管理所有工程的依赖版本。
1. 使用`<exclusions>`去除多余的依赖，IDEA提供相关可视化的操作。
1. 根据最近依赖策略使用`<dependency>`，直接在当前项目中指定依赖版本。

> 实际开发中依赖冲突的问题复杂多变，需要具体问题具体处理。除了上面三种解决方法，工程结构调整也是一个可能的选择。

## 循环依赖

正常情况下，循环依赖是很少见的，当很多个项目互相引用的时候，就可能出现循环依赖，一般根据错误信息就能解决循环依赖。

### 解决循环依赖

1. 使用`build-helper-maven-plugin`插件可以解决无法构建的问题，但是只是一个规避措施，工程的依赖关系依然是混乱的。

> 比如A依赖B，B依赖C，C依赖A的情况。这个插件提供了一种规避措施，即临时地将工程A、B、C合并成一个中间工程，编译出临时的模块D。然后A、B、C再分别依赖临时模块D进行编译。

1. 通过重构，从根本上消除循环依赖。
1. 如果循环依赖中确实有多余的部分，可以使用`<exclusions>`去除多余的依赖。(IDEA可以通过图像化界面定位循环依赖)

## 补充

### Maven的基础知识

- groupId是项目组织唯一的标识符，实际对应JAVA的包的结构，是main目录里java的目录结构。

一般分为多个段，第一段为域，第二段为公司名称…域又分为org、com、cn等等许多，其中org为非营利组织，com为商业组织。

- artifactId是项目的唯一的标识符，实际对应项目的名称，就是项目根目录的名称。

一个Maven项目，同一个groupId同一个artifactId下，只会加载一个version。

```xml
例如：
<dependency>
    <groupId>org.xiaohui</groupId>
    <artifactId>maven-desc</artifactId>
    <version>5.3.8</version>
</dependency>
```

依照这个设置，包结构最好是`org.xiaohui.maven-desc`。如果有个StudentDao，那全路径就是`org.xiaohui.maven-desc.dao.StudentDao`。

### Maven仓库有哪些

![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/ac197d8a600062684f92a200c461552d.webp)

1. 本地仓库
   本地仓库指的是`${user_home}/.m2/repository/`，Maven默认会先从本地仓库内寻找所需Jar包。如果本地仓库不存在，Maven才会向远程仓库请求下载，同时缓存到本地仓库。

1. 远程仓库分为中央仓库，私服和其他公共库。

1. 1. 中央仓库
      Maven自带的远程仓库，不需要特殊配置。如果私服上也不存在Maven所需 Jar包，那么就去中央仓库上下载Jar包，同时缓存在私服和本地仓库。
   1. 私服
      为了节省资源，一般是局域网内设置的私有服务器，当本地仓库内不存在Maven 所需Jar包时，会先去私服上下载Jar包。（内网速度要大于从外部仓库拉取镜像的速度）
   1. 其他公共库
      为了解决中央仓库网络对于国内不稳定的问题，常用如阿里云镜像仓库。

### Maven的打包命令

IDEA中的Maven插件功能如图：

![img](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/e1a1d41a685dd43de85d8bb700e1e77c.webp)

这个图表示Maven逐次递进（执行下面的命令就会包含上面的）的打包命令。

常用的打包命令：

1. clean：清理本地工程Jar包。
1. package：本地工程打成Jar包。会执行clean和compile。
1. install：将本地工程Jar上传到本地仓库。
1. deploy：上传到远程仓库。

### Maven的依赖范围（scope）

代码有编译、测试、运行的过程，显然有些依赖只用于测试，比如Junit；有些依赖编译用不到，只有运行的时候才能用到，比如MySQL的驱动包在编译期就用不到（编译期用的是JDBC接口），而是在运行时用到的；还有些依赖，编译期要用到，而运行期不需要提供，因为有些容器已经提供了，比如servlet-api在tomcat中已经提供了，只需要的是编译期提供而已。

所以Maven支持指定依赖的scope：

1. compile：默认的scope，运行期有效，需要打入包中。
1. provided：编译期有效，运行期不需要提供，不会打入包中。
1. runtime：编译不需要，在运行期有效，需要导入包中。（接口与实现分离）
1. test：测试需要，不会打入包中。